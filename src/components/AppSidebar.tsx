import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Heart, Calendar, Gamepad2, BookOpen, LogOut, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/dates", icon: Calendar, label: "Date Log" },
  { to: "/games", icon: Gamepad2, label: "Scoreboard" },
  { to: "/study", icon: BookOpen, label: "Study" },
];

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card/90 backdrop-blur-md flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-6 border-b border-border">
        <Heart className="h-6 w-6 text-primary fill-primary" />
        <h1 className="font-serif text-xl font-semibold text-foreground">Our Little World</h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        {user && (
          <p className="text-xs text-muted-foreground px-4 mb-2 truncate">
            {user.email}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
