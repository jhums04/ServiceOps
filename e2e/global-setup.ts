import { serviceClient } from "./support";

export default async function globalSetup() {
  const { error } = await serviceClient().rpc("reset_demo_data");
  if (error) throw error;
}
