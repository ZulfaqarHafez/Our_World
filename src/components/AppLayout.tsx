import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Mobile nav */}
      <div className="md:hidden">
        <MobileNav />
      </div>

      {/* Main content */}
      <main className="md:ml-64 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
