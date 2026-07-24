import Link from "next/link";
import {
  Boxes,
  Building2,
  ChevronRight,
  Map,
  MapPin,
  PackageSearch,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  store_code: string;
  store_name: string;
  city: string | null;
  state: string | null;
};

async function getStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("id, store_code, store_name, city, state")
    .eq("active", true)
    .order("store_code");

  if (error) {
    console.error("Unable to load stores:", error.message);
    return [];
  }

  return data ?? [];
}

export default async function
