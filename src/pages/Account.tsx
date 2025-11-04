import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Phone, Camera } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/context/useAuth";
import { firestore, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const Account: React.FC = () => {
  const { user, signOutFn } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const d = await getDoc(doc(firestore, "users", user.uid));
        const data = d.data() || {};
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setBirthdate(data.birthdate || "");
        setProfileUrl(data.profilePhotoUrl || null);
      } catch (e) {
        console.debug("No se pudo cargar perfil", e);
      }
    };
    load();
  }, [user]);

  const handleFile = (f: File | null) => {
    setProfileFile(f);
    if (f) setProfileUrl(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let uploadedUrl: string | null = profileUrl;
      if (profileFile) {
        const path = `users/${user.uid}/profile.jpg`;
        const r = ref(storage, path);
        const contentType = profileFile.type || "image/jpeg";
        await uploadBytes(r, profileFile, { contentType });
        uploadedUrl = await getDownloadURL(r);
      }
      await setDoc(
        doc(firestore, "users", user.uid),
        {
          firstName: firstName || null,
          lastName: lastName || null,
          birthdate: birthdate || null,
          profilePhotoUrl: uploadedUrl || null,
        },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 pb-20">
      {/* Header con logo y branding */}
      <div className="p-4 border-b border-amber-100 bg-amber-50">
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Intu" className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold text-green-800">Mi cuenta</h1>
            <p className="text-green-700 text-sm">Configura tu perfil</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="border-green-100">
          <CardContent className="p-6 space-y-4">
            {/* Bloque de foto al inicio */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-amber-100 overflow-hidden border border-amber-200">
                {profileUrl ? (
                  <img src={profileUrl} alt="perfil" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-500">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
              </div>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
                className="bg-white"
              />
            </div>

            {/* Teléfono */}
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-green-700" />
              <div>
                <div className="flex items-center space-x-2 text-sm text-green-700">
                  <Phone className="h-4 w-4" />
                  <span>{user?.phoneNumber || "+51 —"}</span>
                </div>
              </div>
            </div>

            {/* Campos del perfil */}
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm text-green-700">Nombre</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Tu nombre"
                className="bg-white"
              />
              <label className="text-sm text-green-700">Apellido</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tu apellido"
                className="bg-white"
              />
              <label className="text-sm text-green-700">Fecha de nacimiento</label>
              <Input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="mt-2 flex gap-3">
              <Button
                className="bg-green-700 hover:bg-green-800 text-white"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
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
      </div>
    </div>
  );
};

export default Account;