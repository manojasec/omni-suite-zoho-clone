import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="md:sticky md:top-6 md:self-start">
        <SettingsNav />
      </aside>
      <div>{children}</div>
    </div>
  );
}
