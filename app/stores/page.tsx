import Link from "next/link";
import { Building2, ChevronRight, MapPin } from "lucide-react";
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
    console.error(error.message);
    return [];
  }

  return data ?? [];
}

export default async function StoresPage() {
  const stores = await getStores();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Inventory Manager</p>
          <h1>Stores</h1>
          <p className="subtitle">
            Select a store to view its filters.
          </p>
        </div>

        <div className="profile-badge">JS</div>
      </header>

      <section className="stores-list">
        {stores.map((store) => (
          <Link
            className="store-card"
            href={`/stores/${store.id}`}
            key={store.id}
          >
            <span className="store-icon">
              <Building2 size={24} />
            </span>

            <span className="store-information">
              <span className="store-code">
                {store.store_code}
              </span>

              <strong>{store.store_name}</strong>

              <span className="store-location">
                <MapPin size={15} />
                {[store.city, store.state]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </span>

            <ChevronRight size={22} />
          </Link>
        ))}
      </section>

      <nav className="mobile-nav">
        <Link className="nav-item" href="/">
          Dashboard
        </Link>

        <Link className="nav-item active" href="/stores">
          Stores
        </Link>

        <Link className="nav-item" href="/inventory">
          Inventory
        </Link>

        <Link className="nav-item" href="/routes">
          Routes
        </Link>
      </nav>
    </main>
  );
}
