import { redirect } from "next/navigation";

export default function InventoryIndex() {
  redirect("/app/inventory/items");
}
