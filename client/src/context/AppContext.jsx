import React,{createContext,useCallback,useContext,useEffect,useMemo,useState,useSyncExternalStore} from "react";
import {ApiError,authRequest} from "../api/auth.js";
import {createSessionManager} from "../api/session.js";
import {getData,requestData} from "../api/data.js";
import useNotifications from "../hooks/useNotifications.js";
import {
  categories as seedCategories,
  users as seedUsers,
  moderators as seedModerators,
  initialTraces,
  initialTides,
  initialReports,
  initialHistory,
  initialLogs,
} from "../data/mockData.js";

const AppContext=createContext(null);

const ROLE_NAMES={
  user:"Ana Ramos",
  mod:"Rica Lopez",
  admin:"Admin Doy",
};

export function AppProvider({children}){
  const [sessions]=useState(createSessionManager);
  const {account,ready:sessionReady,error:sessionError,notice:sessionNotice}=useSyncExternalStore(sessions.subscribe,sessions.getSnapshot);
  const {authenticate,clearSession,retrySession}=sessions;

  useEffect(()=>sessions.start(),[sessions]);

  const role=account?.role||null;
  const profile=account?.profile||null;

  const [darkMode,setDarkMode]=useState(()=>
    typeof window!=="undefined"&&localStorage.getItem("tidetrace-dark-mode")==="true"
  );

  const [toast,setToast]=useState("");

  useEffect(()=>{
    const shouldUseDarkMode=darkMode&&!!role;

    document.documentElement.classList.toggle("dark-mode",shouldUseDarkMode);

    if(typeof window!=="undefined"){
      localStorage.setItem("tidetrace-dark-mode",String(darkMode));
    }
  },[darkMode,role]);

  const [traces,setTraces]=useState(initialTraces);
  const [tides,setTides]=useState(initialTides);
  const [reports,setReports]=useState(initialReports);
  const [history,setHistory]=useState(initialHistory);
  const [logs,setLogs]=useState(initialLogs);
  const [users,setUsers]=useState(seedUsers);
  const [moderators,setModerators]=useState(seedModerators);
  const [categories,setCategories]=useState(seedCategories);

  const showToast=useCallback((msg)=>{
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t=window.setTimeout(()=>setToast(""),2600);
  },[]);

  const login=useCallback((email,password)=>authenticate(async()=>{
    const data=await authRequest("login",{body:{email:email.trim(),password}});
    if(!data.session)throw new ApiError("No sign-in session was returned. Please try again.","MISSING_SESSION");
    return data.session;
  }),[authenticate]);

  const register=useCallback((fields)=>authenticate(async()=>{
    const data=await authRequest("register",{body:fields});
    return data.session;
  }),[authenticate]);

  const verifySignup=useCallback((email,token)=>authenticate(async()=>{
    const data=await authRequest("verify",{body:{email,token,type:"signup"}});
    if(!data.session)throw new ApiError("No sign-in session was returned. Please log in again.","MISSING_SESSION");
    return data.session;
  }),[authenticate]);

  const confirmSession=useCallback((session)=>authenticate(()=>session),[authenticate]);
  const resendConfirmation=useCallback((email)=>authRequest("resend",{body:{email}}),[]);

  const logout=useCallback(async()=>{
    try{
      await sessions.logout();
    }catch(error){
      if(error.status!==401){
        showToast("Signed out here. The server could not confirm sign-out; your session will expire automatically.");
      }
    }
  },[sessions,showToast]);

  const readData=useCallback(async(path,{signal}={})=>{
    const owner=sessions.getSnapshot().account?.profile.id;
    let current=sessions.getSnapshot().account;

    if(!owner)throw new ApiError("Sign in to continue.","UNAUTHENTICATED",401);

    if(current.expiresAt<=Date.now()/1000+60){
      await sessions.retrySession();
      current=sessions.getSnapshot().account;
    }

    if(!current||current.profile.id!==owner||current.expiresAt<=Date.now()/1000){
      throw new ApiError("Reconnect to your account and try again.","SESSION_EXPIRED",401);
    }

    let data;

    try{
      data=await getData(path,{token:current.accessToken,signal});
    }catch(error){
      if(error.status===403){
        await sessions.retrySession();
        throw error;
      }

      if(error.status!==401||signal?.aborted)throw error;

      await sessions.retrySession();
      current=sessions.getSnapshot().account;

      if(!current||current.profile.id!==owner||signal?.aborted)throw error;

      data=await getData(path,{token:current.accessToken,signal});
    }

    if(sessions.getSnapshot().account?.profile.id!==owner){
      throw new ApiError("Request cancelled.","CANCELLED");
    }

    return data;
  },[sessions]);

  const writeData=useCallback(async(path,{method,body,file,signal})=>{
    const owner=sessions.getSnapshot().account?.profile.id;
    let current=sessions.getSnapshot().account;

    if(!owner)throw new ApiError("Sign in to continue.","UNAUTHENTICATED",401);

    if(current.expiresAt<=Date.now()/1000+60){
      await sessions.retrySession();
      current=sessions.getSnapshot().account;
    }

    if(!current||current.profile.id!==owner||current.expiresAt<=Date.now()/1000){
      throw new ApiError("Reconnect to your account and try again.","SESSION_EXPIRED",401);
    }

    if(signal?.aborted)throw new ApiError("Request cancelled.","CANCELLED");

    let data;

    try{
      data=await requestData(path,{method,body,file,token:current.accessToken,signal});
    }catch(error){
      if(error.status===401||error.status===403)await sessions.retrySession();
      throw error;
    }

    if(signal?.aborted||sessions.getSnapshot().account?.profile.id!==owner){
      throw new ApiError("Request cancelled.","CANCELLED");
    }

    return data;
  },[sessions]);

  const notificationState=useNotifications(
    role==="user"?profile?.id:null,
    readData,
    writeData
  );

  const addTrace=useCallback((trace)=>{
    const id="t"+(Math.floor(Math.random()*90000)+10000);

    setTraces(prev=>[
      {
        id,
        status:"pending",
        when:"just now",
        comments:[],
        author:ROLE_NAMES.user,
        ...trace
      },
      ...prev,
    ]);

    return id;
  },[]);

  const decideTrace=useCallback((id,status,note)=>{
    setTraces(prev=>prev.map(t=>(
      t.id===id?{...t,status,note:note||t.note}:t
    )));

    setHistory(prev=>{
      const t=traces.find(tt=>tt.id===id);
      if(!t)return prev;

      return[
        {
          id:"h"+Date.now(),
          title:t.title,
          moderator:ROLE_NAMES.mod,
          decision:status,
          when:"just now",
          note:note||""
        },
        ...prev,
      ];
    });

    setLogs(prev=>[
      {
        id:"g"+Date.now(),
        text:`${ROLE_NAMES.mod} marked a trace as ${status}.`,
        when:"just now"
      },
      ...prev,
    ]);
  },[traces]);

  const addComment=useCallback((traceId,text)=>{
    setTraces(prev=>prev.map(t=>
      t.id===traceId
        ?{
            ...t,
            comments:[
              ...t.comments,
              {
                who:ROLE_NAMES.user,
                when:"just now",
                text
              }
            ]
          }
        :t
    ));
  },[]);

  const resolveReport=useCallback((id,action)=>{
    setReports(prev=>prev.map(r=>(
      r.id===id?{...r,status:action}:r
    )));
  },[]);

  const toggleTideProgress=useCallback((id,progress)=>{
    setTides(prev=>prev.map(t=>(
      t.id===id?{...t,progress}:t
    )));
  },[]);

  const suspendUser=useCallback((id)=>{
    setUsers(prev=>prev.map(u=>(
      u.id===id
        ?{...u,status:u.status==="active"?"suspended":"active"}
        :u
    )));
  },[]);

  const editUser=useCallback((id,changes)=>{
    setUsers(prev=>prev.map(u=>(
      u.id===id?{...u,...changes}:u
    )));
  },[]);

  const addModerator=useCallback((mod)=>{
    setModerators(prev=>[
      ...prev,
      {
        id:"m"+Date.now(),
        reviewed:0,
        ...mod
      }
    ]);

    setLogs(prev=>[
      {
        id:"g"+Date.now(),
        text:`${ROLE_NAMES.admin} added moderator ${mod.name}.`,
        when:"just now"
      },
      ...prev,
    ]);
  },[]);

  const editModerator=useCallback((id,changes)=>{
    setModerators(prev=>prev.map(mod=>
      mod.id===id?{...mod,...changes}:mod
    ));
  },[]);

  const removeModerator=useCallback((id)=>{
    setModerators(prev=>prev.filter(mod=>mod.id!==id));
  },[]);

  const removeCategory=useCallback((name)=>{
    setCategories(prev=>prev.filter(category=>category!==name));
  },[]);

  const addTide=useCallback((tide)=>{
    setTides(prev=>[
      {
        id:"l"+Date.now(),
        progress:0,
        ...tide
      },
      ...prev,
    ]);
  },[]);

  const addCategory=useCallback((name)=>{
    setCategories(prev=>(
      prev.includes(name)
        ?prev
        :[
            ...prev.filter(c=>c!=="Other"),
            name,
            "Other"
          ]
    ));
  },[]);

  const value=useMemo(
    () => ({
      role,
      profile,

      darkMode,
      setDarkMode,

      readData,
      writeData,
      sessionReady,
      sessionError,
      sessionNotice,
      retrySession,
      login,
      register,
      verifySignup,
      confirmSession,
      clearSession,
      resendConfirmation,
      logout,

      toast,
      showToast,

      traces,
      addTrace,
      decideTrace,
      addComment,

      tides,
      toggleTideProgress,
      addTide,


      reports,
      resolveReport,

      ...notificationState,

      history,
      logs,

      users,
      suspendUser,
      editUser,

      moderators,
      addModerator,
      editModerator,
      removeModerator,

      removeCategory,
      categories,
      addCategory,
    }),
    [
      role,
      profile,
      darkMode,
      readData,
      writeData,
      sessionReady,
      sessionError,
      sessionNotice,
      retrySession,
      login,
      register,
      verifySignup,
      confirmSession,
      clearSession,
      resendConfirmation,
      logout,
      toast,
      showToast,
      traces,
      tides,
      reports,
      notificationState,
      history,
      logs,
      users,
      moderators,
      categories,
      addTrace,
      decideTrace,
      addComment,
      toggleTideProgress,
      addTide,
      resolveReport,
      suspendUser,
      editUser,
      addModerator,
      editModerator,
      removeModerator,
      removeCategory,
      addCategory,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(){
  const ctx=useContext(AppContext);

  if(!ctx){
    throw new Error("useApp must be used within AppProvider");
  }

  return ctx;
}