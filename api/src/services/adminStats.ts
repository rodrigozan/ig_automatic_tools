import { Types } from "mongoose";

export async function countsByUser(_ids: Types.ObjectId[]): Promise<Map<string, Record<string, number>>> {
  return new Map();
}
