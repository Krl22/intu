import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Route, User } from "lucide-react";

const navItems = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/trips", label: "Viajes", icon: Route },
  { to: "/account", label: "Cuenta", icon: User },
];

const BottomNav: React.FC = () => {
  const location = useLocation();

  // Ocultar en la página de selección de mapa a pantalla completa
  if (
    location.pathname === "/select-destination" ||
    location.pathname === "/route" ||
    location.pathname === "/login"
  )
    return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white">
      <div className="mx-auto max-w-md">
        <ul className="flex justify-around py-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center px-3 py-1 text-xs ${
                    isActive ? "text-green-700" : "text-gray-600"
                  }`
                }
              >
                <Icon className="h-6 w-6" />
                <span className="mt-1">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default BottomNav;