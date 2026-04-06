"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Shield, Copy, ClipboardCheck, Key, List, FileX, Loader2, Clock, CalendarDays } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const DURATION_OPTIONS = [
  { value: "30", label: "30 jours", days: 30 },
  { value: "90", label: "3 mois", days: 90 },
  { value: "18", label: "6 mois", days: 180 },
  { value: "36", label: "1 an", days: 365 },
  { value: "UL", label: "Illimité", days: 36500 },
];

interface License {
  id: string;
  machineCode: string;
  activationCode: string;
  clientName: string | null;
  durationDays: number;
  createdAt: string;
  expiryDate?: string;
}

export default function AdminLicensePanel() {
  const [machineCode, setMachineCode] = useState("");
  const [duration, setDuration] = useState("");
  const [clientName, setClientName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedExpiry, setGeneratedExpiry] = useState("");
  const [generatedDuration, setGeneratedDuration] = useState("");
  const [copied, setCopied] = useState(false);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loadingLicenses, setLoadingLicenses] = useState(true);
  const [error, setError] = useState("");

  const fetchLicenses = useCallback(async () => {
    setLoadingLicenses(true);
    try {
      const res = await fetch("/api/admin/license");
      const data = await res.json();
      if (res.ok && Array.isArray(data.licenses)) {
        setLicenses(data.licenses);
      } else {
        toast.error("Erreur lors du chargement des licences");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoadingLicenses(false);
    }
  }, []);

  // Load licenses on mount
  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const handleGenerate = async () => {
    if (!machineCode.trim()) {
      setError("Le code machine est obligatoire");
      return;
    }
    if (!duration) {
      setError("Veuillez choisir une durée");
      return;
    }

    setError("");
    setGenerating(true);
    setGeneratedCode("");

    try {
      const res = await fetch("/api/admin/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineCode: machineCode.trim(),
          duration,
          clientName: clientName.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.code) {
        setGeneratedCode(data.code);
        setGeneratedExpiry(data.expiryDate || "Jamais");
        setGeneratedDuration(data.durationLabel || DURATION_OPTIONS.find((o) => o.value === duration)?.label || "");
        toast.success("Code généré avec succès !");
        fetchLicenses();
      } else {
        setError(data.error || "Erreur lors de la génération");
        toast.error(data.error || "Erreur de génération");
      }
    } catch {
      setError("Erreur de connexion au serveur");
      toast.error("Erreur de connexion");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = async (code: string, target: "generated" | "table") => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copié !");
      if (target === "generated") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      toast.error("Impossible de copier le code");
    }
  };

  const getDurationLabel = (days: number): string => {
    const found = DURATION_OPTIONS.find((o) => o.days === days);
    if (found) return found.label;
    if (days === 0) return "Illimité";
    return `${days} jours`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-5">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-white">
          <Shield className="w-6 h-6" />
          Gestion des Licences
        </CardTitle>
      </CardHeader>

      <CardContent className="px-6 py-5">
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="w-full bg-gray-100 rounded-xl h-11 p-1">
            <TabsTrigger
              value="generate"
              className="flex-1 rounded-lg h-9 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2"
            >
              <Key className="w-4 h-4" />
              Générer un Code
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex-1 rounded-lg h-9 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2"
            >
              <List className="w-4 h-4" />
              Licences Générées
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Generate Code */}
          <TabsContent value="generate" className="space-y-4 pt-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Erreur</AlertTitle>
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {/* Client Name */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Nom du client
                </Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Auto-école ABC"
                  className="h-11 rounded-xl border-2 border-gray-200 focus:border-emerald-400"
                  disabled={generating}
                />
              </div>

              {/* Machine Code */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Code Machine du client <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={machineCode}
                  onChange={(e) => setMachineCode(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                  className="h-11 rounded-xl border-2 border-gray-200 focus:border-emerald-400 font-mono tracking-wider"
                  disabled={generating}
                />
              </div>

              {/* Duration Select */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">
                  Durée
                </Label>
                <Select value={duration} onValueChange={setDuration} disabled={generating}>
                  <SelectTrigger className="w-full h-11 rounded-xl border-2 border-gray-200 focus:border-emerald-400">
                    <SelectValue placeholder="Sélectionner une durée" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generating || !machineCode.trim() || !duration}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Génération en cours...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Générer le Code d&apos;Activation
                  </span>
                )}
              </Button>
            </div>

            {/* Generated Code Result */}
            {generatedCode && (
              <div className="mt-5 p-5 rounded-xl bg-emerald-50 border-2 border-emerald-200 space-y-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-emerald-700">
                    Code d&apos;Activation :
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-12 rounded-lg bg-white border border-emerald-200 flex items-center justify-center px-4">
                    <span className="font-mono text-lg md:text-xl font-bold text-emerald-800 tracking-widest break-all text-center">
                      {generatedCode}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyCode(generatedCode, "generated")}
                    className="shrink-0 h-12 w-12 hover:bg-emerald-100 border-emerald-300 rounded-lg"
                    title="Copier le code"
                  >
                    {copied ? (
                      <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Copy className="h-5 w-5 text-emerald-600" />
                    )}
                  </Button>
                </div>

                <Separator className="bg-emerald-200" />

                <div className="flex flex-col sm:flex-row gap-3 text-sm text-emerald-700">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-emerald-500" />
                    <span>Expire le : <strong>{generatedExpiry}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <span>Durée : <strong>{generatedDuration}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: License History */}
          <TabsContent value="history" className="pt-4">
            {loadingLicenses ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                  <p className="text-gray-500 text-sm">Chargement...</p>
                </div>
              </div>
            ) : licenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileX className="w-16 h-16 mb-4 opacity-40" />
                <p className="text-base font-medium">Aucune licence générée</p>
                <p className="text-sm mt-1">Les licences apparaîtront ici une fois générées</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Table Header */}
                    <div className="grid grid-cols-6 bg-gray-50 border-b border-gray-200 px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">
                      <div className="col-span-1">Client</div>
                      <div className="col-span-1">Code Machine</div>
                      <div className="col-span-1">Code Activation</div>
                      <div className="col-span-1">Durée</div>
                      <div className="col-span-1">Expiration</div>
                      <div className="col-span-1">Créé le</div>
                    </div>

                    {/* Table Body */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                      {licenses.map((license) => (
                        <div
                          key={license.id}
                          className="grid grid-cols-6 px-4 py-3 items-center hover:bg-gray-50 transition-colors gap-2"
                        >
                          {/* Client Name */}
                          <div className="col-span-1 text-sm font-medium text-gray-800 truncate">
                            {license.clientName ? (
                              <span>{license.clientName}</span>
                            ) : (
                              <span className="text-gray-400 italic">Non spécifié</span>
                            )}
                          </div>

                          {/* Machine Code */}
                          <div className="col-span-1">
                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md break-all">
                              {license.machineCode}
                            </span>
                          </div>

                          {/* Activation Code */}
                          <div className="col-span-1">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md break-all flex-1">
                                {license.activationCode}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopyCode(license.activationCode, "table")}
                                className="shrink-0 h-7 w-7 hover:bg-emerald-50"
                                title="Copier"
                              >
                                <Copy className="h-3.5 w-3.5 text-gray-500" />
                              </Button>
                            </div>
                          </div>

                          {/* Duration */}
                          <div className="col-span-1">
                            <Badge variant="secondary" className="text-xs font-medium bg-gray-100 text-gray-700">
                              {getDurationLabel(license.durationDays)}
                            </Badge>
                          </div>

                          {/* Expiry Date */}
                          <div className="col-span-1 text-xs text-gray-600">
                            {license.expiryDate ? formatDate(license.expiryDate) : "Illimité"}
                          </div>

                          {/* Created At */}
                          <div className="col-span-1 text-xs text-gray-500">
                            {formatDate(license.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
