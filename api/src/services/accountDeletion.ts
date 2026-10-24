import { User } from "../models/User";

export async function deleteUserData(userId: string) {
  await User.deleteOne({ _id: userId });
}
