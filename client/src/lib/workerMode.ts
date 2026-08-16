import { api, setStoredToken } from "./api";
import type { User } from "./types";

type UpdateUserResponse = User & {
  token?: string;
  accountModes?: User["accountModes"];
};

/** Enable worker (seller) mode and refresh the JWT when the API returns one. */
export async function enableWorkerMode(
  user: User,
  refreshUser: (user: User | null) => void
): Promise<User> {
  const res = await api<UpdateUserResponse>(`/api/users/update/${user._id}`, {
    method: "PUT",
    body: { isSeller: true },
  });
  if (res.token) setStoredToken(res.token);
  const nextUser: User = {
    ...user,
    ...res,
    isSeller: true,
    accountModes: res.accountModes ?? {
      ...user.accountModes,
      customer: true,
      worker: true,
      employer: Boolean(user.isEmployer || user.accountModes?.employer),
      admin: Boolean(user.isAdmin || user.accountModes?.admin),
    },
  };
  refreshUser(nextUser);
  return nextUser;
}
