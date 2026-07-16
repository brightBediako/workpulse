export type AccountModes = {
  customer: boolean;
  worker: boolean;
  employer: boolean;
  admin: boolean;
};

export type User = {
  _id: string;
  username: string;
  email?: string;
  img?: string;
  country?: string;
  address?: string;
  phone?: string;
  desc?: string;
  isSeller?: boolean;
  isEmployer?: boolean;
  isAdmin?: boolean;
  isVerified?: boolean;
  verificationStatus?: string;
  accountModes?: AccountModes;
  companyName?: string | null;
};

export type Gig = {
  _id: string;
  userId: string;
  title: string;
  desc: string;
  cat: string;
  price: number;
  cover: string;
  images?: string[];
  shortTitle?: string;
  shortDesc?: string;
  deliveryTime?: number;
  revisionNumber?: number;
  features?: string[];
  sales?: number;
  totalStars?: number;
  starNumber?: number;
  status?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    area?: string;
  };
};

export type Category = {
  slug: string;
  label: string;
  description?: string;
};

export type Order = {
  _id: string;
  title: string;
  price: number;
  status: string;
  isCompleted: boolean;
  img?: string;
  gigId: string;
  sellerId: string;
  buyerId: string;
  payment_intent?: string;
};

export type Notification = {
  _id: string;
  message: string;
  type: string;
  link?: string;
  read: boolean;
  createdAt?: string;
};

export type Conversation = {
  id: string;
  sellerId: string;
  buyerId: string;
  lastMessage?: string;
  readBySeller?: boolean;
  readByBuyer?: boolean;
};

export type Job = {
  _id: string;
  title: string;
  description: string;
  cat: string;
  status: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  location?: { city?: string; region?: string };
};
