export interface User {
  id: string;
  username: string;
  email: string;
  avatarColor?: string; // For visual flair
}

export interface Group {
  id: string;
  name: string;
  description: string;
  createdBy: string; // user_id
  joinCode: string;
  memberCount: number; // Mock stat
}

export type Role = 'ADMIN' | 'MEMBER';

export interface GroupMember {
  userId: string;
  groupId: string;
  role: Role;
}

export type MessageStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Message {
  id: string;
  groupId: string;
  senderId: string; // Needed to show "My Posts" in profile, even if anonymous to others
  content: string;
  status: MessageStatus;
  createdAt: string; // ISO string
  aiAnalysis?: string; // Optional AI safety score/reasoning
  likes: number; // For engagement
}

export interface AppState {
  currentUser: User | null;
  groups: Group[];
  memberships: GroupMember[];
  messages: Message[];
}