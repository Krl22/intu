import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import MapSelect from "./pages/MapSelect";
import Trips from "./pages/Trips";
import TripDetail from "./pages/TripDetail";
import Account from "./pages/Account";
import BottomNav from "./components/BottomNav";
import RoutePreview from "./pages/RoutePreview";
import RateDriver from "./pages/RateDriver";
import Login from "./pages/Login";
import { useAuth } from "./context/useAuth";

function App() {
  const { user, loading } = useAuth();
  return (
    <Router>
      <div className="min-h-screen pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-screen text-green-800">Cargando…</div>
        ) : (
          <>
            <Routes>
              {!user ? (
                <>
                  <Route path="/login" element={<Login />} />
                  <Route path="*" element={<Login />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<Home />} />
                  <Route path="/select-destination" element={<MapSelect />} />
                  <Route path="/route" element={<RoutePreview />} />
                  <Route path="/rate/:id" element={<RateDriver />} />
                  <Route path="/trips" element={<Trips />} />
                  <Route path="/trips/:id" element={<TripDetail />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/login" element={<Home />} />
                </>
              )}
            </Routes>
            <BottomNav />
          </>
        )}
      </div>
    </Router>
  );
}

export default App;
