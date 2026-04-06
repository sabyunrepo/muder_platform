import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

import { CHAT_MESSAGE_LIMIT, FRIEND_LIST_LIMIT } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FriendResponse {
  id: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
  friendship_id: string;
  since: string;
}

export interface PendingRequestResponse {
  friendship_id: string;
  requester_id: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
}

export interface BlockResponse {
  id: string;
  blocked_id: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
}

export interface ChatRoomSummary {
  id: string;
  type: "DM" | "GROUP";
  name: string | null;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

export interface ChatRoomResponse {
  id: string;
  type: string;
  name: string | null;
  created_at: string;
  members: ChatMemberResponse[];
}

export interface ChatMemberResponse {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  joined_at: string;
  last_read_at: string;
}

export interface ChatMessageResponse {
  id: number;
  chat_room_id: string;
  sender_id: string;
  sender_nickname: string;
  sender_avatar: string | null;
  content: string;
  message_type: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const socialKeys = {
  all: ["social"] as const,
  friends: () => [...socialKeys.all, "friends"] as const,
  pending: () => [...socialKeys.all, "pending"] as const,
  blocks: () => [...socialKeys.all, "blocks"] as const,
  chatRooms: () => [...socialKeys.all, "chatRooms"] as const,
  chatRoom: (id: string) => [...socialKeys.all, "chatRooms", id] as const,
  messages: (roomId: string) =>
    [...socialKeys.all, "chatRooms", roomId, "messages"] as const,
};

// ---------------------------------------------------------------------------
// Friend Queries
// ---------------------------------------------------------------------------

export function useFriends(limit = FRIEND_LIST_LIMIT, offset = 0) {
  return useQuery<FriendResponse[]>({
    queryKey: [...socialKeys.friends(), limit, offset],
    queryFn: () =>
      api.get<FriendResponse[]>(
        `/v1/social/friends?limit=${limit}&offset=${offset}`,
      ),
  });
}

export function usePendingRequests(limit = FRIEND_LIST_LIMIT, offset = 0) {
  return useQuery<PendingRequestResponse[]>({
    queryKey: [...socialKeys.pending(), limit, offset],
    queryFn: () =>
      api.get<PendingRequestResponse[]>(
        `/v1/social/friends/pending?limit=${limit}&offset=${offset}`,
      ),
  });
}

// ---------------------------------------------------------------------------
// Friend Mutations
// ---------------------------------------------------------------------------

export function useSendFriendRequest() {
  return useMutation<void, Error, { addressee_id: string }>({
    mutationFn: (body) => api.postVoid("/v1/social/friends/request", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.pending() });
    },
  });
}

export function useAcceptFriendRequest() {
  return useMutation<void, Error, string>({
    mutationFn: (friendshipId) =>
      api.postVoid(`/v1/social/friends/${friendshipId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.friends() });
      queryClient.invalidateQueries({ queryKey: socialKeys.pending() });
    },
  });
}

export function useRejectFriendRequest() {
  return useMutation<void, Error, string>({
    mutationFn: (friendshipId) =>
      api.postVoid(`/v1/social/friends/${friendshipId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.pending() });
    },
  });
}

export function useRemoveFriend() {
  return useMutation<void, Error, string>({
    mutationFn: (friendshipId) =>
      api.deleteVoid(`/v1/social/friends/${friendshipId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.friends() });
    },
  });
}

// ---------------------------------------------------------------------------
// Block Queries & Mutations
// ---------------------------------------------------------------------------

export function useBlocks() {
  return useQuery<BlockResponse[]>({
    queryKey: socialKeys.blocks(),
    queryFn: () => api.get<BlockResponse[]>("/v1/social/blocks"),
  });
}

export function useBlockUser() {
  return useMutation<void, Error, { blocked_id: string }>({
    mutationFn: (body) => api.postVoid("/v1/social/blocks", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.blocks() });
      queryClient.invalidateQueries({ queryKey: socialKeys.friends() });
    },
  });
}

export function useUnblockUser() {
  return useMutation<void, Error, string>({
    mutationFn: (blockedId) =>
      api.deleteVoid(`/v1/social/blocks/${blockedId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.blocks() });
    },
  });
}

// ---------------------------------------------------------------------------
// Chat Queries
// ---------------------------------------------------------------------------

export function useChatRooms(limit = CHAT_MESSAGE_LIMIT, offset = 0) {
  return useQuery<ChatRoomSummary[]>({
    queryKey: [...socialKeys.chatRooms(), limit, offset],
    queryFn: () =>
      api.get<ChatRoomSummary[]>(
        `/v1/social/chat/rooms?limit=${limit}&offset=${offset}`,
      ),
  });
}

export function useChatMessages(
  roomId: string,
  limit = CHAT_MESSAGE_LIMIT,
  offset = 0,
) {
  return useQuery<ChatMessageResponse[]>({
    queryKey: [...socialKeys.messages(roomId), limit, offset],
    queryFn: () =>
      api.get<ChatMessageResponse[]>(
        `/v1/social/chat/rooms/${roomId}/messages?limit=${limit}&offset=${offset}`,
      ),
    enabled: !!roomId,
  });
}

// ---------------------------------------------------------------------------
// Chat Mutations
// ---------------------------------------------------------------------------

export function useCreateDMRoom() {
  return useMutation<ChatRoomResponse, Error, { user_id: string }>({
    mutationFn: (body) =>
      api.post<ChatRoomResponse>("/v1/social/chat/dm", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.chatRooms() });
    },
  });
}

export function useCreateGroupRoom() {
  return useMutation<
    ChatRoomResponse,
    Error,
    { name: string; member_ids: string[] }
  >({
    mutationFn: (body) =>
      api.post<ChatRoomResponse>("/v1/social/chat/group", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.chatRooms() });
    },
  });
}

export function useSendMessage(roomId: string) {
  return useMutation<
    ChatMessageResponse,
    Error,
    { content: string; message_type?: string }
  >({
    mutationFn: (body) =>
      api.post<ChatMessageResponse>(
        `/v1/social/chat/rooms/${roomId}/messages`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.messages(roomId) });
      queryClient.invalidateQueries({ queryKey: socialKeys.chatRooms() });
    },
  });
}

export function useMarkAsRead(roomId: string) {
  return useMutation<void, Error, void>({
    mutationFn: () =>
      api.postVoid(`/v1/social/chat/rooms/${roomId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.chatRooms() });
      queryClient.invalidateQueries({ queryKey: socialKeys.chatRoom(roomId) });
    },
  });
}
