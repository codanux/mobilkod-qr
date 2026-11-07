type View = "menu" | "orders" | "profile" | "addresses";

type Props = {
  view: View;
  directory?: boolean;
  onNavigate: (view: "menu" | "orders" | "profile") => void;
};

export function BottomNav({ view, directory = false, onNavigate }: Props) {
  return <nav className="bottom-nav" aria-label="Ana gezinme">
    <button type="button" className={view === "menu" ? "bottom-nav-item active" : "bottom-nav-item"}
      aria-current={view === "menu" ? "page" : undefined} onClick={() => onNavigate("menu")}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h6v6H4zm10 0h6v6h-6zM4 15.5h6v4H4zm10 0h6v4h-6z" /></svg>
      <span>{directory ? "Restoranlar" : "Menü"}</span>
    </button>
    <button type="button" className={view === "orders" ? "bottom-nav-item active" : "bottom-nav-item"}
      aria-current={view === "orders" ? "page" : undefined} onClick={() => onNavigate("orders")}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.75h10a2 2 0 0 1 2 2v14.5l-7-3.5-7 3.5V5.75a2 2 0 0 1 2-2Z" /><path d="M9 8h6m-6 4h6" /></svg>
      <span>Siparişlerim</span>
    </button>
    <button type="button" className={view === "profile" || view === "addresses" ? "bottom-nav-item active" : "bottom-nav-item"}
      aria-current={view === "profile" || view === "addresses" ? "page" : undefined} onClick={() => onNavigate("profile")}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
      <span>Bilgilerim</span>
    </button>
  </nav>;
}
