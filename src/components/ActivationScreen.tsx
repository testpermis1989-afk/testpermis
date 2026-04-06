"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Car, Clipboard, ClipboardCheck, ShieldCheck, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ActivationScreenProps {
  onActivated: () => void;
}

export default function ActivationScreen({ onActivated }: ActivationScreenProps) {
  const [machineCode, setMachineCode] = useState<string>("");
  const [activationCode, setActivationCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [activating, setActivating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Fetch machine code and activation status on mount
  useEffect(() => {
    const fetchLicense = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/license");
        const data = await res.json();

        if (res.ok) {
          if (data.activated) {
            onActivated();
            return;
          }
          if (data.machineCode) {
            setMachineCode(data.machineCode);
          }
          if (data.reason) {
            setError(data.reason);
          }
        } else {
          setError(data.error || "Impossible de récupérer les informations de licence");
        }
      } catch {
        setError("Erreur de connexion au serveur");
      } finally {
        setLoading(false);
      }
    };
    fetchLicense();
  }, [onActivated]);

  const handleCopy = async () => {
    if (!machineCode) return;
    try {
      await navigator.clipboard.writeText(machineCode);
      setCopied(true);
      toast.success("Code copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossible de copier le code automatiquement");
    }
  };

  const handleActivate = async () => {
    if (!activationCode.trim()) {
      setError("Veuillez entrer un code d'activation");
      return;
    }

    setActivating(true);
    setError("");

    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationCode: activationCode.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Activation réussie !");
        onActivated();
      } else {
        setError(data.error || "Code d'activation invalide");
      }
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative z-10 w-full max-w-lg">
        <Card className="bg-white rounded-2xl shadow-2xl border-0 overflow-hidden">
          {/* Header with gradient */}
          <CardHeader className="text-center bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 pt-8 pb-6 space-y-3">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border-2 border-white/30">
                <Car className="w-9 h-9 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Activation requise
            </CardTitle>
            <p className="text-emerald-100 text-sm leading-relaxed">
              Veuillez contacter l&apos;administrateur pour obtenir un code d&apos;activation
            </p>
          </CardHeader>

          <CardContent className="space-y-5 px-6 pt-6 pb-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Erreur</AlertTitle>
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            {/* Machine Code Section */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">
                Votre Code Machine
              </Label>
              <div className="relative">
                {loading ? (
                  <div className="w-full h-14 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center">
                    <div className="w-6 h-6 border-3 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="w-full h-14 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-between px-4 hover:border-emerald-300 transition-colors">
                    <span className="font-mono text-lg md:text-xl font-bold text-gray-800 tracking-wider break-all pr-3 select-all">
                      {machineCode}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopy}
                      className="shrink-0 h-10 w-10 hover:bg-emerald-50 rounded-lg"
                      title="Copier le code"
                    >
                      {copied ? (
                        <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Clipboard className="h-5 w-5 text-gray-500" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Activation Code Input */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">
                Entrez votre Code d&apos;Activation
              </Label>
              <Input
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                className="h-14 text-lg font-mono text-center tracking-widest rounded-xl border-2 border-gray-200 focus:border-emerald-400 focus:ring-emerald-400/20"
                onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                disabled={activating || loading}
              />
            </div>

            {/* Activate Button */}
            <Button
              onClick={handleActivate}
              disabled={activating || loading || !activationCode.trim()}
              className="w-full h-13 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
            >
              {activating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Activation en cours...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Activer
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Bottom help text */}
        <p className="text-center mt-5 text-gray-300 text-sm leading-relaxed">
          Pour obtenir un code, envoyez votre <span className="text-gray-200 font-medium">Code Machine</span> à votre administrateur
        </p>
      </div>
    </div>
  );
}
