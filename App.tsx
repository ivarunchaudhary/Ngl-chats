import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { User, Group, Message, GroupMember } from './types';
import { Button } from './components/Button';
import { Header } from './components/Header';
import { analyzeMessageSafety, polishMessage } from './services/geminiService';
import { 
  Users, Plus, Shield, Check, X, Sparkles, MessageSquare, 
  LogOut, ArrowRight, ArrowLeft, User as UserIcon, Home, Zap, Heart, 
  MoreHorizontal, Activity, Lock, Send, Search, CheckCircle, Camera, ChevronRight
} from 'lucide-react';

// --- MOCK DATA ---
const MOCK_CONTACTS: User[] = [
  { id: 'u2', username: 'campus_queen', email: 'queen@college.edu', avatarColor: 'bg-rose-500' },
  { id: 'u3', username: 'gym_rat_99', email: 'gains@college.edu', avatarColor: 'bg-emerald-600' },
  { id: 'u4', username: 'study_buddy', email: 'books@college.edu', avatarColor: 'bg-sky-500' },
  { id: 'u5', username: 'party_animal', email: 'lit@college.edu', avatarColor: 'bg-amber-500' },
  { id: 'u6', username: 'coding_wizard', email: 'dev@college.edu', avatarColor: 'bg-violet-600' },
  { id: 'u7', username: 'art_major', email: 'paint@college.edu', avatarColor: 'bg-fuchsia-400' },
  { id: 'u8', username: 'coffee_addict', email: 'java@college.edu', avatarColor: 'bg-stone-600' },
  { id: 'u9', username: 'musician_guy', email: 'music@college.edu', avatarColor: 'bg-cyan-500' },
  { id: 'u10', username: 'future_ceo', email: 'biz@college.edu', avatarColor: 'bg-indigo-800' },
];

const INITIAL_GROUPS: Group[] = [
  { id: 'g1', name: 'Dorm 304 Confessions', description: 'What happens in 304 stays in 304.', createdBy: 'u2', joinCode: 'DORM304', memberCount: 142 },
  { id: 'g2', name: 'CS Department Feedback', description: 'Honest feedback for the faculty.', createdBy: 'u1', joinCode: 'CSROCKS', memberCount: 89 },
  { id: 'g3', name: 'Late Night Thoughts', description: '3AM vibes only.', createdBy: 'u3', joinCode: 'VIBES', memberCount: 320 }
];

const INITIAL_MEMBERSHIPS: GroupMember[] = [
  { userId: 'u1', groupId: 'g1', role: 'MEMBER' },
  { userId: 'u1', groupId: 'g2', role: 'ADMIN' },
  { userId: 'u2', groupId: 'g1', role: 'ADMIN' },
  { userId: 'u3', groupId: 'g3', role: 'ADMIN' },
];

const INITIAL_MESSAGES: Message[] = [
  { id: 'm1', groupId: 'g1', senderId: 'u2', content: 'Someone keeps stealing my oat milk and I know who it is.', status: 'APPROVED', createdAt: new Date(Date.now() - 86400000).toISOString(), likes: 12 },
  { id: 'm2', groupId: 'g1', senderId: 'u1', content: 'I actually miss the 8am lectures.', status: 'PENDING', createdAt: new Date().toISOString(), likes: 0 },
  { id: 'm3', groupId: 'g2', senderId: 'u3', content: 'Prof. Smith is amazing but the assignments are too long.', status: 'APPROVED', createdAt: new Date(Date.now() - 100000).toISOString(), likes: 45 },
];

// --- CONTEXT ---
interface AppContextType {
  user: User | null;
  login: (username: string) => void;
  logout: () => void;
  groups: Group[];
  contacts: User[];
  createGroup: (name: string, desc: string, initialMembers: string[]) => void;
  joinGroup: (code: string) => void;
  messages: Message[];
  postMessage: (groupId: string, content: string) => void;
  updateMessageStatus: (msgId: string, status: 'APPROVED' | 'REJECTED') => void;
  toggleLike: (msgId: string) => void;
  memberships: GroupMember[];
  getReputation: () => number;
}

const AppContext = React.createContext<AppContextType | null>(null);

const useAppContext = () => {
  const context = React.useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};

// --- PROVIDER ---
const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [memberships, setMemberships] = useState<GroupMember[]>(INITIAL_MEMBERSHIPS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [contacts] = useState<User[]>(MOCK_CONTACTS);

  const login = (username: string) => {
    // Elegant muted colors for current user
    const colors = ['bg-slate-800', 'bg-zinc-700', 'bg-neutral-600'];
    const color = colors[username.length % colors.length];
    
    setUser({ 
      id: 'u1', 
      username, 
      email: `${username}@college.edu`,
      avatarColor: color 
    });
  };

  const logout = () => setUser(null);

  const createGroup = (name: string, description: string, initialMembers: string[]) => {
    const newGroup: Group = {
      id: `g${Date.now()}`,
      name,
      description,
      createdBy: user!.id,
      joinCode: Math.random().toString(36).substring(7).toUpperCase(),
      memberCount: 1 + initialMembers.length
    };
    
    setGroups([newGroup, ...groups]);
    
    const newMemberships: GroupMember[] = [
      { userId: user!.id, groupId: newGroup.id, role: 'ADMIN' },
      ...initialMembers.map(uid => ({ userId: uid, groupId: newGroup.id, role: 'MEMBER' as const }))
    ];
    
    setMemberships([...memberships, ...newMemberships]);
  };

  const joinGroup = (code: string) => {
    const group = groups.find(g => g.joinCode === code);
    if (group) {
      const exists = memberships.find(m => m.userId === user!.id && m.groupId === group.id);
      if (!exists) {
        setMemberships([...memberships, { userId: user!.id, groupId: group.id, role: 'MEMBER' }]);
        setGroups(groups.map(g => g.id === group.id ? {...g, memberCount: g.memberCount + 1} : g));
      }
    } else {
      alert("Invalid join code");
    }
  };

  const postMessage = (groupId: string, content: string) => {
    const newMsg: Message = {
      id: `m${Date.now()}`,
      groupId,
      senderId: user!.id,
      content,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      likes: 0
    };
    setMessages([newMsg, ...messages]);
  };

  const updateMessageStatus = (msgId: string, status: 'APPROVED' | 'REJECTED') => {
    setMessages(messages.map(m => m.id === msgId ? { ...m, status } : m));
  };

  const toggleLike = (msgId: string) => {
    setMessages(messages.map(m => m.id === msgId ? { ...m, likes: m.likes + 1 } : m));
  };

  const getReputation = () => {
    if (!user) return 0;
    const myMessages = messages.filter(m => m.senderId === user.id);
    let score = 100;
    myMessages.forEach(m => {
      if (m.status === 'APPROVED') score += 10 + (m.likes * 2);
      if (m.status === 'REJECTED') score -= 5;
    });
    return score;
  };

  return (
    <AppContext.Provider value={{ user, login, logout, groups, contacts, createGroup, joinGroup, messages, postMessage, updateMessageStatus, toggleLike, memberships, getReputation }}>
      {children}
    </AppContext.Provider>
  );
};

// --- COMPONENTS ---

const NavigationBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 pb-safe pt-2 px-6 flex justify-around items-center z-50 max-w-md mx-auto h-[80px] pb-4">
      <button 
        onClick={() => navigate('/groups')}
        className={`flex flex-col items-center gap-1.5 transition-colors ${active === '/groups' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
      >
        <Home size={24} strokeWidth={active === '/groups' ? 2.5 : 2} />
        <span className="text-[10px] font-medium tracking-wide">Home</span>
      </button>
      
      <button 
        onClick={() => navigate('/profile')}
        className={`flex flex-col items-center gap-1.5 transition-colors ${active === '/profile' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
      >
        <UserIcon size={24} strokeWidth={active === '/profile' ? 2.5 : 2} />
        <span className="text-[10px] font-medium tracking-wide">Profile</span>
      </button>
    </div>
  );
};

// --- VIEWS ---

const LoginView = () => {
  const { login } = useAppContext();
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      login(username);
      navigate('/groups');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-white px-8">
      <div className="max-w-sm mx-auto w-full">
        <div className="mb-12">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-6">
            <Users size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-3">Welcome Back</h1>
          <p className="text-zinc-500 leading-relaxed">
            Enter your handle to access your anonymous communities.
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-zinc-400 font-medium">@</span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-white border border-zinc-200 focus:border-zinc-900 rounded-lg outline-none transition-all font-medium text-zinc-900 placeholder:text-zinc-300"
                placeholder="username"
                required
              />
            </div>
          </div>
          <Button type="submit" size="lg" fullWidth>
            Continue
          </Button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-400">
            By continuing, you acknowledge our <span className="text-zinc-900 underline cursor-pointer">Community Standards</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

const GroupListView = () => {
  const { groups, contacts, memberships, createGroup, joinGroup, user } = useAppContext();
  
  const [createPhase, setCreatePhase] = useState<'NONE' | 'PARTICIPANTS' | 'INFO'>('NONE');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  
  const [showJoin, setShowJoin] = useState(false);
  const [inputCode, setInputCode] = useState('');
  
  const navigate = useNavigate();

  const myGroups = useMemo(() => groups.filter(g => memberships.some(m => m.groupId === g.id && m.userId === user?.id)), [groups, memberships, user]);
  const suggestedGroups = useMemo(() => groups.filter(g => !memberships.some(m => m.groupId === g.id && m.userId === user?.id)), [groups, memberships, user]);

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleCreate = () => {
    if (!newGroupName.trim()) return;
    createGroup(newGroupName, newGroupDesc, selectedContacts);
    setCreatePhase('NONE');
    setSelectedContacts([]);
    setNewGroupName('');
    setNewGroupDesc('');
  };

  // --- WIZARD PHASES ---

  if (createPhase === 'PARTICIPANTS') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header 
          title="Add Participants" 
          showBack 
          onBack={() => setCreatePhase('NONE')} 
          rightAction={<span className="text-sm text-zinc-500">{selectedContacts.length} selected</span>}
        />

        {selectedContacts.length > 0 && (
          <div className="px-4 py-3 border-b border-zinc-100 flex gap-3 overflow-x-auto no-scrollbar bg-zinc-50/50">
            {selectedContacts.map(id => {
              const contact = contacts.find(c => c.id === id);
              if (!contact) return null;
              return (
                <div key={id} className="flex flex-col items-center gap-1 min-w-[60px] animate-in fade-in zoom-in duration-200">
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full ${contact.avatarColor} flex items-center justify-center text-white font-semibold text-sm`}>
                      {contact.username.substring(0,2).toUpperCase()}
                    </div>
                    <button onClick={() => toggleContact(id)} className="absolute -top-1 -right-1 bg-zinc-900 rounded-full p-0.5 text-white border-2 border-white">
                      <X size={10} />
                    </button>
                  </div>
                  <span className="text-[10px] truncate w-full text-center text-zinc-600 font-medium">{contact.username}</span>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {contacts.map(contact => {
             const isSelected = selectedContacts.includes(contact.id);
             return (
               <div key={contact.id} onClick={() => toggleContact(contact.id)} className="flex items-center gap-4 p-4 border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer transition-colors active:bg-zinc-100">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full ${contact.avatarColor} flex items-center justify-center text-white font-medium text-xs`}>
                      {contact.username.substring(0,2).toUpperCase()}
                    </div>
                    {isSelected && (
                      <div className="absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-0.5 text-white border-2 border-white">
                        <Check size={10} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                     <h3 className={`text-sm ${isSelected ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>{contact.username}</h3>
                     <p className="text-xs text-zinc-400">{contact.email}</p>
                  </div>
               </div>
             );
          })}
          <div className="h-24"></div> 
        </div>

        <div className="fixed bottom-6 right-6 z-50">
          <button 
             onClick={() => setCreatePhase('INFO')}
             disabled={selectedContacts.length === 0} 
             className="w-14 h-14 bg-zinc-900 rounded-full shadow-lg flex items-center justify-center text-white disabled:opacity-50 disabled:scale-95 transition-all active:scale-90 hover:bg-zinc-800"
          >
            <ArrowRight size={24} />
          </button>
        </div>
      </div>
    );
  }

  if (createPhase === 'INFO') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header 
          title="New Group" 
          showBack 
          onBack={() => setCreatePhase('PARTICIPANTS')} 
        />

        <div className="p-8 flex flex-col items-center">
          <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-8 text-zinc-400 cursor-pointer hover:bg-zinc-200 transition-colors border border-dashed border-zinc-300">
            <Camera size={28} />
          </div>

          <div className="w-full space-y-8">
            <div className="border-b border-zinc-200 focus-within:border-zinc-900 transition-colors">
              <input 
                 value={newGroupName}
                 onChange={(e) => setNewGroupName(e.target.value)}
                 placeholder="Group Name"
                 className="w-full text-xl py-3 outline-none bg-transparent font-semibold text-zinc-900 placeholder:text-zinc-300"
                 maxLength={25}
              />
            </div>

             <div className="border-b border-zinc-200 focus-within:border-zinc-900 transition-colors">
              <input 
                 value={newGroupDesc}
                 onChange={(e) => setNewGroupDesc(e.target.value)}
                 placeholder="Description (Optional)"
                 className="w-full text-sm py-3 outline-none bg-transparent text-zinc-600 placeholder:text-zinc-300"
              />
            </div>
          </div>
        </div>

        <div className="fixed bottom-6 right-6 z-50">
          <button 
             onClick={handleCreate}
             disabled={!newGroupName.trim()} 
             className="w-14 h-14 bg-zinc-900 rounded-full shadow-lg flex items-center justify-center text-white disabled:opacity-50 disabled:scale-95 transition-all active:scale-90 hover:bg-zinc-800"
          >
            <Check size={24} />
          </button>
        </div>
      </div>
    );
  }

  // --- DEFAULT VIEW ---

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <Header 
        title="Chats" 
        rightAction={
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-semibold text-xs">
            {user?.username.substring(0,2).toUpperCase()}
          </div>
        } 
      />
      
      <div className="p-4 space-y-6">
        
        {/* Actions */}
        {showJoin ? (
           <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm animate-in fade-in slide-in-from-top-2">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-semibold text-zinc-900">Join Community</h3>
               <button onClick={() => setShowJoin(false)} className="text-zinc-400 hover:text-zinc-900"><X size={18}/></button>
             </div>
             <div className="flex gap-2">
                <input 
                  placeholder="CODE" 
                  className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono uppercase tracking-widest focus:border-zinc-900 outline-none transition-all"
                  value={inputCode} onChange={e => setInputCode(e.target.value)}
                />
                <Button size="sm" onClick={() => { joinGroup(inputCode); setShowJoin(false); }}>
                  Join
                </Button>
              </div>
           </div>
        ) : (
          <div className="flex gap-3">
            <button 
              onClick={() => setCreatePhase('PARTICIPANTS')}
              className="flex-1 p-4 bg-white rounded-xl border border-zinc-200 shadow-sm text-left hover:border-zinc-300 transition-all active:scale-[0.99]"
            >
              <div className="mb-3 w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                <Plus size={18} />
              </div>
              <span className="font-semibold text-zinc-900 block text-sm">New Group</span>
            </button>

            <button 
               onClick={() => setShowJoin(true)}
               className="flex-1 p-4 bg-white rounded-xl border border-zinc-200 shadow-sm text-left hover:border-zinc-300 transition-all active:scale-[0.99]"
            >
              <div className="mb-3 w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                <Zap size={18} />
              </div>
              <span className="font-semibold text-zinc-900 block text-sm">Join Group</span>
            </button>
          </div>
        )}

        {/* Group List */}
        <div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">My Communities</h2>
          <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-50 overflow-hidden shadow-sm">
            {myGroups.map(group => {
              const isAdmin = memberships.find(m => m.groupId === group.id && m.userId === user?.id)?.role === 'ADMIN';
              return (
                <div 
                  key={group.id} 
                  onClick={() => navigate(`/group/${group.id}`)} 
                  className="p-4 hover:bg-zinc-50 cursor-pointer transition-colors flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-200 transition-colors">
                    <Users size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="font-semibold text-zinc-900 text-sm truncate">{group.name}</h3>
                      {isAdmin && <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-medium">ADMIN</span>}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{group.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300" />
                </div>
              );
            })}
            
            {myGroups.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-400">No groups yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Suggested */}
        {suggestedGroups.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">Suggested</h2>
            <div className="space-y-2">
              {suggestedGroups.map(group => (
                <div key={group.id} className="p-4 bg-white rounded-xl border border-zinc-200 flex items-center justify-between shadow-sm">
                  <div className="min-w-0 flex-1 pr-4">
                     <h3 className="font-semibold text-zinc-900 text-sm truncate">{group.name}</h3>
                     <p className="text-xs text-zinc-500 mt-0.5">{group.memberCount} members</p>
                  </div>
                  <button 
                    onClick={() => {
                        setInputCode(group.joinCode);
                        setShowJoin(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-2 bg-zinc-50 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <NavigationBar />
    </div>
  );
};

const ProfileView = () => {
  const { user, getReputation, messages, logout, memberships } = useAppContext();
  const reputation = getReputation();
  const myPosts = messages.filter(m => m.senderId === user?.id);
  const myGroupCount = memberships.filter(m => m.userId === user?.id).length;

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <Header title="Profile" />

      <div className="p-6">
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-zinc-900 flex items-center justify-center mb-4 ring-4 ring-zinc-50">
            <span className="text-2xl text-white font-bold">{user?.username.substring(0, 2).toUpperCase()}</span>
          </div>
          
          <h1 className="text-xl font-bold text-zinc-900 mb-1">@{user?.username}</h1>
          <p className="text-zinc-400 text-sm mb-6">{user?.email}</p>

          <div className="flex justify-center gap-4 border-t border-zinc-100 pt-6">
            <div className="text-center px-4">
              <span className="block text-xl font-bold text-zinc-900">{reputation}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Rep</span>
            </div>
            <div className="text-center px-4 border-l border-zinc-100">
              <span className="block text-xl font-bold text-zinc-900">{myPosts.length}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Posts</span>
            </div>
             <div className="text-center px-4 border-l border-zinc-100">
              <span className="block text-xl font-bold text-zinc-900">{myGroupCount}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Groups</span>
            </div>
          </div>
        </div>

        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Activity History</h2>
        
        <div className="space-y-3">
          {myPosts.length === 0 ? (
             <div className="text-center py-10 text-zinc-400 text-sm bg-white rounded-xl border border-zinc-200 border-dashed">No activity yet.</div>
          ) : (
            myPosts.map(msg => (
              <div key={msg.id} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex gap-3">
                 <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${msg.status === 'APPROVED' ? 'bg-emerald-500' : msg.status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
                 <div className="flex-1 min-w-0">
                   <p className="text-zinc-800 text-sm font-medium mb-1 line-clamp-2">"{msg.content}"</p>
                   <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span>{new Date(msg.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="capitalize">{msg.status.toLowerCase()}</span>
                   </div>
                 </div>
                 <div className="flex flex-col items-center justify-center px-2">
                    <Heart size={14} className="text-zinc-300 mb-1" />
                    <span className="text-xs font-bold text-zinc-500">{msg.likes}</span>
                 </div>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={logout} 
          className="mt-8 w-full py-3.5 rounded-lg text-rose-600 font-medium bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      <NavigationBar />
    </div>
  );
};

const GroupDetailView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { groups, messages, memberships, user, postMessage, updateMessageStatus, toggleLike } = useAppContext();
  const [activeTab, setActiveTab] = useState<'feed' | 'post' | 'admin'>('feed');
  const [newMsg, setNewMsg] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [adminCheckResult, setAdminCheckResult] = useState<{[key:string]: string}>({});

  const group = groups.find(g => g.id === id);
  if (!group) return <Navigate to="/groups" />;

  const myMembership = memberships.find(m => m.groupId === id && m.userId === user?.id);
  const isAdmin = myMembership?.role === 'ADMIN';

  const approvedMessages = messages.filter(m => m.groupId === id && m.status === 'APPROVED');
  const pendingMessages = messages.filter(m => m.groupId === id && m.status === 'PENDING');

  const handlePost = async () => {
    if (!newMsg.trim()) return;
    postMessage(group.id, newMsg);
    setNewMsg('');
    setActiveTab('feed');
  };

  const handlePolish = async () => {
    setIsPolishing(true);
    const result = await polishMessage(newMsg);
    setNewMsg(result);
    setIsPolishing(false);
  };

  const checkSafety = async (msgId: string, content: string) => {
    setAdminCheckResult(prev => ({ ...prev, [msgId]: 'Checking...' }));
    const result = await analyzeMessageSafety(content);
    setAdminCheckResult(prev => ({ ...prev, [msgId]: result }));
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header 
        title={group.name} 
        showBack 
        onBack={() => navigate('/groups')} 
        rightAction={<div className="text-[10px] font-bold bg-zinc-100 px-2 py-1 rounded text-zinc-500 tracking-wider font-mono">{group.joinCode}</div>}
      />

      {/* Tabs */}
      <div className="px-4 py-2 bg-white border-b border-zinc-100 sticky top-14 z-40">
        <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg">
          <button 
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'feed' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Feed
          </button>
          <button 
            onClick={() => setActiveTab('post')}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'post' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Post
          </button>
          {isAdmin && (
             <button 
             onClick={() => setActiveTab('admin')}
             className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'admin' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
           >
             Admin {pendingMessages.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>}
           </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 pb-10 pt-4 overflow-y-auto bg-zinc-50">
        
        {/* FEED TAB */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
             {approvedMessages.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                 <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare size={20} className="text-zinc-300" />
                 </div>
                 <p className="text-sm font-medium">No messages yet.</p>
               </div>
             ) : (
               approvedMessages.map(msg => (
                 <div key={msg.id} className={`flex flex-col ${msg.senderId === user?.id ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                      msg.senderId === user?.id 
                        ? 'bg-zinc-900 text-white rounded-br-sm' 
                        : 'bg-white text-zinc-800 border border-zinc-200 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>

                    <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <button 
                          onClick={() => toggleLike(msg.id)}
                          className="flex items-center gap-1 text-zinc-400 hover:text-rose-500 transition-colors"
                        >
                          <Heart size={12} className={msg.likes > 0 ? "fill-rose-500 text-rose-500" : ""} />
                          {msg.likes > 0 && <span className="text-[10px] font-bold">{msg.likes}</span>}
                        </button>
                    </div>
                 </div>
               ))
             )}
          </div>
        )}

        {/* POST TAB */}
        {activeTab === 'post' && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
              <label className="text-xs font-bold text-zinc-900 uppercase mb-3 block tracking-wide">Compose Message</label>
              <textarea
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Type your confession..."
                className="w-full h-32 p-4 bg-zinc-50 rounded-lg border border-zinc-200 focus:border-zinc-900 focus:ring-0 outline-none resize-none text-sm mb-4 transition-all"
              />

              <div className="flex justify-end mb-6">
                 <button 
                  onClick={handlePolish} 
                  disabled={isPolishing || !newMsg}
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
                 >
                   <Sparkles size={14} className={isPolishing ? "animate-spin" : ""} />
                   {isPolishing ? 'Polishing...' : 'AI Polish'}
                 </button>
              </div>

              <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg mb-6 border border-zinc-100">
                <Shield size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500 leading-normal">
                  Your identity is hidden. Admins review all posts.
                </p>
              </div>

              <Button fullWidth onClick={handlePost} disabled={!newMsg}>
                Send Anonymously
              </Button>
            </div>
          </div>
        )}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-4">
            {pendingMessages.length === 0 ? (
               <div className="text-center py-10">
                 <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                   <Check size={18} />
                 </div>
                 <p className="text-sm font-medium text-zinc-500">All caught up</p>
               </div>
            ) : (
              pendingMessages.map(msg => (
                <div key={msg.id} className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                     <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-bold rounded uppercase tracking-wide">Review</span>
                     <span className="text-[10px] text-zinc-400 font-mono">{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  
                  <p className="text-zinc-900 mb-4 font-medium text-sm">"{msg.content}"</p>
                  
                  {adminCheckResult[msg.id] && (
                    <div className={`mb-4 p-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${adminCheckResult[msg.id].includes('Safe') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      <Shield size={12} />
                      {adminCheckResult[msg.id]}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => updateMessageStatus(msg.id, 'APPROVED')}
                      className="flex-1 bg-zinc-900 text-white py-2 rounded-lg font-semibold text-xs hover:bg-zinc-800 transition-colors"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => updateMessageStatus(msg.id, 'REJECTED')}
                      className="flex-1 bg-white border border-zinc-200 text-zinc-600 py-2 rounded-lg font-semibold text-xs hover:bg-zinc-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => checkSafety(msg.id, msg.content)}
                      className="px-3 bg-zinc-100 text-zinc-500 rounded-lg hover:bg-zinc-200 transition-colors"
                      title="AI Check"
                    >
                      <Shield size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- APP ROOT ---

const AppContent = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginView />} />
      <Route path="/groups" element={<GroupListView />} />
      <Route path="/profile" element={<ProfileView />} />
      <Route path="/group/:id" element={<GroupDetailView />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

const App = () => {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl border-x border-zinc-100 relative font-sans">
      <HashRouter>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </HashRouter>
    </div>
  );
};

export default App;