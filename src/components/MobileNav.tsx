import { NavLink, useLocation } from "react-router-dom";
import { Home, Calendar, Gamepad2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/dates", icon: Calendar, label: "Dates" },
  { to: "/games", icon: Gamepad2, label: "Games" },
  { to: "/study", icon: BookOpen, label: "Study" },
];

const MobileNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border px-2 py-2">
      <div className="flex items-center justify-around">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "animate-pulse-soft")} />
              {label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
