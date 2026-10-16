import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
import Home from './index.jsx';
const session=vi.hoisted(()=>({role:null}));
vi.mock('../../context/AppContext.jsx',()=>({useApp:()=>session}));
vi.mock('../../components/home/reactbits/GradientWaves.jsx',()=>({default:()=>null}));
vi.mock('../../hooks/useCommunitySummary.js',()=>({default:()=>({loading:false,data:{published_traces:12,contributors:4,published_tides:3,tides_completed:27},error:''}),communityMetrics:[['published_traces','Traces published'],['contributors','Community contributors'],['published_tides','Tides available'],['tides_completed','Tides completed']]}));
const open=()=>render(<MemoryRouter><Home/></MemoryRouter>);
it('shows the completed reduced-motion page and live totals',()=>{
 session.role=null;open();
 expect(screen.getByText('Explore · Contribute · Learn')).toBeTruthy();
 expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1);
 expect(screen.getByText('Community participation')).toBeTruthy();
 expect(screen.getAllByText('27',{selector:'b'})).toHaveLength(1);
 expect(screen.getByRole('link',{name:"Start Tracing — it's free"}).getAttribute('href')).toBe('/register');
 expect(document.querySelectorAll('main')).toHaveLength(1);
 expect(document.querySelectorAll('.tt-pending')).toHaveLength(0);
});
it('closes navigation with Escape and returns focus to the toggle',()=>{
 open();const toggle=screen.getByRole('button',{name:'Open menu'});fireEvent.click(toggle);
 expect(toggle.getAttribute('aria-expanded')).toBe('true');fireEvent.keyDown(toggle,{key:'Escape'});
 expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(toggle);
});
it('routes authenticated contributors to upload and restores scroll preferences on unmount',()=>{
 session.role='user';const previous=document.documentElement.style.scrollBehavior;const page=open();
 expect(screen.getByRole('link',{name:'Start Tracing',exact:true}).getAttribute('href')).toBe('/user/traces/upload');
 expect(document.documentElement.style.scrollBehavior).toBe('auto');page.unmount();expect(document.documentElement.style.scrollBehavior).toBe(previous);
});
