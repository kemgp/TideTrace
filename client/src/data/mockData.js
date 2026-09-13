// Shared simulated data for the TideTrace prototype.
// In a real app this would come from an API — here it seeds React state
// in AppContext so every page reads/writes the same in-memory "database".

export const categories = [
  "Coral condition",
  "Mangroves",
  "Fisheries",
  "Pollution",
  "Oral history",
  "Other",
];

export const users = [
  { id: "u1", name: "Ana Ramos", email: "ana@tidetrace.app", barangay: "Brgy. Lawis", status: "active", traces: 12, joined: "Jan 2026" },
  { id: "u2", name: "Ben Cruz", email: "ben@tidetrace.app", barangay: "Brgy. Punta", status: "active", traces: 5, joined: "Feb 2026" },
  { id: "u3", name: "Cora Diaz", email: "cora@tidetrace.app", barangay: "Brgy. Candayas", status: "suspended", traces: 2, joined: "Mar 2026" },
  { id: "u4", name: "Deo Santos", email: "deo@tidetrace.app", barangay: "Brgy. Lawis", status: "active", traces: 8, joined: "Mar 2026" },
];

export const moderators = [
  { id: "m1", name: "Rica Lopez", email: "rica@tidetrace.app", permissions: ["Review traces", "Manage comments", "Manage reports"], reviewed: 142 },
  { id: "m2", name: "Jon Reyes", email: "jon@tidetrace.app", permissions: ["Review traces", "View analytics"], reviewed: 76 },
];

export const initialTraces = [
  { id: "t1", title: "Bleaching patch near Sitio Lawis", category: "Coral condition", location: "Brgy. Lawis", author: "Aling Nena", description: "Noticed a pale patch of coral roughly 4 meters across near the drop-off. Water was warmer than usual this week.", status: "approved", when: "2h ago", comments: [{ who: "Ben Cruz", when: "1h ago", text: "Saw this too, seems to be spreading toward the reef wall." }] },
  { id: "t2", title: "40 new mangrove seedlings planted", category: "Mangroves", location: "Brgy. Punta", author: "Brgy. Youth Group", description: "Weekend planting drive along the tidal flat, seedlings sourced from the community nursery.", status: "approved", when: "5h ago", comments: [] },
  { id: "t3", title: "Reduced catch reported by local fishers", category: "Fisheries", location: "Brgy. Candayas", author: "Deo Santos", description: "Several boats reported smaller catches than the same week last year.", status: "pending", when: "1d ago", comments: [] },
  { id: "t4", title: "Plastic waste washed up after storm", category: "Pollution", location: "Brgy. Lawis", author: "Ana Ramos", description: "Large amount of plastic debris on the shoreline following last night's storm surge.", status: "pending", when: "1d ago", comments: [] },
  { id: "t5", title: "Grandmother's story on tide reading", category: "Oral history", location: "Brgy. Candayas", author: "Cora Diaz", description: "Recorded a short interview about traditional ways of predicting tides using moon position.", status: "revision", note: "Could you add roughly when this tradition was practiced?", comments: [] },
  { id: "t6", title: "Seagrass bed looks thinner this month", category: "Coral condition", location: "Brgy. Punta", author: "Ben Cruz", description: "Comparing to photos from two months ago, coverage looks noticeably reduced.", status: "rejected", note: "Please resubmit with a clearer, well-lit photo of the area.", comments: [] },
];

export const initialTides = [
  { id: "l1", title: "Understanding coral bleaching", duration: "8 min", module: "Reef basics", progress: 100 },
  { id: "l2", title: "Why mangroves matter", duration: "6 min", module: "Coastal ecosystems", progress: 40 },
  { id: "l3", title: "Reading the tides, the old way", duration: "10 min", module: "Local knowledge", progress: 0 },
  { id: "l4", title: "Sustainable fishing basics", duration: "7 min", module: "Fisheries", progress: 0 },
];

export const initialComments = [
  { id: "c1", trace: "Bleaching patch near Sitio Lawis", who: "Guest_204", text: "This is fake, nothing is happening here.", status: "open" },
  { id: "c2", trace: "40 new mangrove seedlings planted", who: "Guest_118", text: "Spam link removed by filter — visit myshop.example", status: "open" },
];

export const initialReports = [
  { id: "r1", target: "Reduced catch reported by local fishers", reporter: "Ben Cruz", reason: "Possible duplicate of an earlier trace", status: "open" },
  { id: "r2", target: "Plastic waste washed up after storm", reporter: "Cora Diaz", reason: "Location pin looks incorrect", status: "open" },
];

export const initialNotifications = [
  { id: "n1", group: "Today", text: "Your trace \u201cBleaching patch near Sitio Lawis\u201d was approved.", when: "2h ago", unread: true },
  { id: "n2", group: "Today", text: "Rica Lopez commented on your submission.", when: "3h ago", unread: true },
  { id: "n3", group: "This week", text: "New Tides lesson published: \u201cWhy mangroves matter.\u201d", when: "2d ago", unread: false },
];

export const initialHistory = [
  { id: "h1", title: "Reef wall photo set", moderator: "Rica Lopez", decision: "approved", when: "Sep 2, 2026", note: "Clear, well documented." },
  { id: "h2", title: "Unverified fish kill report", moderator: "Jon Reyes", decision: "rejected", when: "Sep 1, 2026", note: "No supporting photo or location." },
  { id: "h3", title: "Community clean-up tally", moderator: "Rica Lopez", decision: "revision", when: "Aug 29, 2026", note: "Please add the barangay name." },
];

export const initialLogs = [
  { id: "g1", text: "Admin Doy suspended user Cora Diaz.", when: "Sep 8, 2026" },
  { id: "g2", text: "Admin Doy added moderator Jon Reyes.", when: "Sep 5, 2026" },
  { id: "g3", text: "Rica Lopez approved 6 traces.", when: "Sep 4, 2026" },
];

export const impactStats = [
  { label: "Species documented", value: "128" },
  { label: "Waste removed", value: "3.2t" },
  { label: "Mangroves funded", value: "640" },
  { label: "Communities supported", value: "14" },
];
