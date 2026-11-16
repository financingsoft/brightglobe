import { apiRequest } from "@/services/api";

export type CommunityTask = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  startsAt: string | null;
  endsAt: string | null;
};

export type InvitationOverview = {
  code: string;
  status: "active" | "disabled";
  referralCount: number;
  referrals: Array<{ id: string; status: "attributed" | "review" | "rejected"; createdAt: string }>;
  rewardsEnabled: false;
};

export type Announcement = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  locale: string;
  publishedAt: string | null;
};

export type AnnouncementDetail = Announcement & { body: string };

export type CommunityEvent = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  startsAt: string | null;
  endsAt: string | null;
  status: "published";
};

export async function getCommunityTasks() {
  return apiRequest<{ items: CommunityTask[]; rewardsEnabled: false }>("/api/v1/community/tasks");
}

export async function getMyInvitation() {
  return apiRequest<InvitationOverview>("/api/v1/community/invites/me");
}

export async function claimInvitation(code: string) {
  return apiRequest<{ attributed: true; rewardsEnabled: false }>("/api/v1/community/invites/claim", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export async function getAnnouncements() {
  return apiRequest<{ items: Announcement[] }>("/api/v1/community/announcements");
}

export async function getAnnouncement(slug: string) {
  return apiRequest<{ item: AnnouncementDetail }>(`/api/v1/community/announcements/${encodeURIComponent(slug)}`);
}

export async function getCommunityEvents() {
  return apiRequest<{ items: CommunityEvent[] }>("/api/v1/community/events");
}
