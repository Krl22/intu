import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/context/useAuth";

const Account: React.FC = () => {
  const { user, signOutFn } = useAuth();
  return (
    <div className="min-h-screen bg-amber-50 pb-20">
      {/* Header con logo y branding */}
      <div className="p-4 border-b border-amber-100 bg-amber-50">
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Intu" className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold text-green-800">Mi cuenta</h1>
            <p className="text-green-700 text-sm">
              Configura tu perfil y preferencias
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="border-green-100">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-green-700" />
              <div>
                <p className="font-medium text-green-800">Nombre del usuario</p>
                <div className="flex items-center space-x-2 text-sm text-green-700">
                  <Mail className="h-4 w-4" />
                  <span>{user?.email || "sin correo"}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-green-700">
                  <Phone className="h-4 w-4" />
                  <span>{user?.phoneNumber || "+51 —"}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button className="bg-green-700 hover:bg-green-800 text-white">
                Editar perfil
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  await signOutFn();
                }}
              >
                Cerrar sesión
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-100">
          <CardContent className="p-6">
            <p className="font-medium text-green-800 mb-2">
              Preferencias rápidas
            </p>
            <div className="space-y-2 text-green-700 text-sm">
              <div className="flex justify-between">
                <span>Recibir notificaciones</span>
                <span className="px-2 py-1 rounded bg-green-100">Activado</span>
              </div>
              <div className="flex justify-between">
                <span>Idioma</span>
                <span className="px-2 py-1 rounded bg-amber-100">Español</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Account;