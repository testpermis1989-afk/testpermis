"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Types
type UserRole = "admin" | "user" | null;
type Screen = "login" | "categories" | "series" | "password" | "counter" | "test" | "result" | "correction" | "admin" | "profile";

interface UserData {
  id: string;
  cin: string;
  nomFr: string | null;
  prenomFr: string | null;
  nomAr: string | null;
  prenomAr: string | null;
  photo: string | null;
  permisCategory: string;
  examDate: string | null;
  pinCode: string;
  isActive: boolean;
  role: string;
}

interface Category {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  questionsPerSeries: number;
  seriesCount: number;
  image: string;
}

// Données des catégories
const categoriesData: Category[] = [
  { id: "A", name: "Moto", nameAr: "دراجة نارية", color: "#3498db", questionsPerSeries: 12, seriesCount: 10, image: "/images/categories/A.png" },
  { id: "B", name: "Voiture", nameAr: "سيارة", color: "#f39c12", questionsPerSeries: 40, seriesCount: 10, image: "/images/categories/B.png" },
  { id: "C", name: "Camion", nameAr: "شاحنة", color: "#2ecc71", questionsPerSeries: 40, seriesCount: 10, image: "/images/categories/C.png" },
  { id: "D", name: "Bus", nameAr: "حافلة", color: "#9b59b6", questionsPerSeries: 40, seriesCount: 10, image: "/images/categories/D.png" },
  { id: "E", name: "Remorque", nameAr: "مقطورة", color: "#2c3e50", questionsPerSeries: 40, seriesCount: 10, image: "/images/categories/E.png" },
];

// ===== COMPOSANTS SVG DE SIGNALISATION =====
const RoadSignsBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
    <div className="absolute top-[5%] right-[5%] w-16 h-16 md:w-28 md:h-28">
      <div className="w-full h-full bg-red-600 rounded-full border-2 md:border-4 border-white flex items-center justify-center">
        <span className="text-white text-xs md:text-lg font-bold">STOP</span>
      </div>
    </div>
  </div>
);

// ===== ÉCRAN DE CONNEXION =====
const LoginScreen = ({ onLogin, onAdminLogin }: { onLogin: (user: UserData) => void; onAdminLogin: () => void }) => {
  const [cin, setCin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!cin.trim()) { setError("N°CIN est obligatoire"); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cin: cin.trim().toUpperCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Identifiants incorrects');
        return;
      }
      onLogin(data.user);
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 flex items-center justify-center p-4">
      <FullscreenButton />
      <RoadSignsBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#FFD700', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>اختبار رخصة القيادة</h1>
          <p className="text-gray-700">Test du Permis de Conduire - Maroc</p>
        </div>
        <div className="bg-white/90 rounded-xl shadow-2xl p-6 border-2 border-gray-300">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" />
                <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" />
              </svg>
            </div>
          </div>
          {error && <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-2 rounded-lg mb-4 text-center">{error}</div>}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">N°CIN - رقم بطاقة التعريف الوطنية</label>
            <input type="text" value={cin.toUpperCase()} onChange={(e) => setCin(e.target.value.toUpperCase())} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-gray-800 uppercase" placeholder="Entrez votre N°CIN" />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-gray-800" placeholder="Entrez votre mot de passe" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
          </div>
          <button onClick={handleLogin} disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:from-blue-600 hover:to-blue-700 shadow-lg disabled:opacity-50">
            {loading ? 'Connexion...' : 'Se connecter / تسجيل الدخول'}
          </button>

        </div>
      </div>
    </div>
  );
};

// ===== ÉCRAN DES CATÉGORIES =====
const CategoriesScreen = ({ user, onSelectCategory, onLogout, onProfile }: { user: UserData | null; onSelectCategory: (cat: Category) => void; onLogout: () => void; onProfile: () => void }) => {
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null);

  // Vérifier si l'utilisateur a accès à une catégorie
  const hasCategoryAccess = (catId: string): boolean => {
    if (!user) return false;
    const pc = user.permisCategory;
    if (pc === 'ALL') return true;
    if (catId === pc || catId === 'B') return true;
    return false;
  };

  // Gérer le clic sur une catégorie
  const handleCategoryClick = (cat: Category) => {
    if (hasCategoryAccess(cat.id)) {
      onSelectCategory(cat);
    } else {
      setAccessDeniedMsg(cat.id);
      setTimeout(() => setAccessDeniedMsg(null), 3000);
    }
  };

  // Précharger les images des catégories
  useEffect(() => {
    let loadedCount = 0;
    const totalImages = categoriesData.length;
    
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalImages) {
        setImagesLoaded(true);
      }
    };

    categoriesData.forEach((cat) => {
      const img = new window.Image();
      img.onload = checkAllLoaded;
      img.onerror = () => {
        console.log(`Image not found: ${cat.image}`);
        checkAllLoaded();
      };
      img.src = cat.image;
    });
    
    // Timeout de sécurité - afficher après 2 secondes max
    const timeout = setTimeout(() => {
      setImagesLoaded(true);
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, []);

  // Afficher un chargement léger
  if (!imagesLoaded) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 relative overflow-hidden">
      <FullscreenButton />
      <RoadSignsBackground />
      <div className="absolute inset-2 md:inset-4 border-2 md:border-4 border-gray-500 rounded-lg bg-gray-300/80 shadow-inner flex flex-col">
        <div className="bg-gray-500 text-white px-4 py-2 flex justify-between items-center rounded-t-lg">
          <div className="flex items-center gap-4">
            {user && user.photo ? (
              <img src={user.photo} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">👤</div>
            )}
            <span className="text-sm">{user ? `${user.prenomFr || ''} ${user.nomFr || ''}` : '👤'}</span>
            <button onClick={onProfile} className="bg-gray-600 hover:bg-gray-400 px-2 py-1 rounded text-xs font-bold">⚙️ Profil</button>
            <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-xs font-bold">❌ Déconnexion</button>
          </div>
          <div className="text-sm font-bold">المملكة المغربية</div>
        </div>
        <div className="text-center py-4">
          <h1 className="text-2xl md:text-4xl font-bold mb-1" style={{ color: '#FFD700', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>اختبار رخصة القيادة</h1>
          <div className="h-1 bg-yellow-500 mx-auto w-3/4 max-w-xl rounded-full shadow-lg" />
          <p className="text-gray-700 text-lg mt-2">Test du Permis de Conduire - Maroc</p>
        </div>
        {/* Message d'accès refusé */}
        {accessDeniedMsg && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border-2 border-red-400">
              <span className="text-2xl">🚫</span>
              <div>
                <p className="font-bold text-sm">Accès refusé!</p>
                <p className="text-xs opacity-90">Vous n'avez pas le droit d'accéder à la catégorie {accessDeniedMsg}</p>
                <p className="text-xs opacity-75 mt-0.5" dir="rtl">ليس لديك الحق في الوصول إلى الفئة {accessDeniedMsg}</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {categoriesData.map((cat) => {
              const hasAccess = hasCategoryAccess(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className={`rounded-xl p-4 shadow-lg transition-all hover:scale-[1.02] group border-2 flex flex-col items-center relative ${
                    hasAccess
                      ? 'bg-white/90 hover:shadow-xl border-gray-300 cursor-pointer'
                      : 'bg-gray-200/70 border-gray-400 opacity-60 cursor-not-allowed hover:opacity-75'
                  }`}
                >
                  {/* Indicateur verrouillé pour catégories non accessibles */}
                  {!hasAccess && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md">🔒</div>
                  )}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg group-hover:scale-110 transition-all mb-2 ${!hasAccess ? 'grayscale' : ''}`} style={{ backgroundColor: cat.color }}>{cat.id}</div>
                  <div className="w-full h-36 relative mb-2 transition-transform duration-200 group-hover:scale-105">
                    <Image src={cat.image} alt={cat.name} fill className={`object-contain p-2 transition-all duration-200 ${hasAccess ? 'group-hover:scale-110 group-hover:brightness-110 brightness-105' : 'grayscale opacity-50'}`} />
                  </div>
                  <p className={`text-lg font-bold ${hasAccess ? 'text-gray-800' : 'text-gray-500'}`}>{cat.name}</p>
                  <p className={`text-sm ${hasAccess ? 'text-gray-600' : 'text-gray-400'}`} dir="rtl">{cat.nameAr}</p>
                  {hasAccess ? (
                    <div className="mt-2 text-red-500 text-lg">▶</div>
                  ) : (
                    <div className="mt-2 text-gray-400 text-xs">🔒 Non accessible</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-center py-2 text-gray-500 text-sm">المملكة المغربية - Royaume du Maroc</div>
      </div>
    </div>
  );
};

// ===== ÉCRAN SÉLECTION SÉRIE =====
const SeriesScreen = ({ category, onSelectSeries, onMelange, onBack }: { category: Category; onSelectSeries: (series: number, chronoTime: number) => void; onMelange: (chronoTime: number) => void; onBack: () => void }) => {
  const [existingSeries, setExistingSeries] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [chronoTime, setChronoTime] = useState(15);
  const userRole = "user";

  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const res = await fetch('/api/questions/import');
        if (!res.ok) return;
        const data = await res.json();
        if (data.categories) {
          const catData = data.categories.find((c: { code: string }) => c.code === category.id);
          if (catData) {
            const nums = catData.series.map((s: { number: number }) => s.number).sort((a: number, b: number) => a - b);
            setExistingSeries(nums);
          }
        }
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    };
    fetchSeries();
  }, [category.id]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 p-4">
      <FullscreenButton />
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-500 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-sm">👤 User</span>
            <button onClick={onBack} className="bg-gray-600 hover:bg-gray-700 px-4 py-1 rounded font-bold">← Retour</button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setChronoTime(prev => Math.max(5, prev - 1))} disabled={chronoTime <= 5} className="text-white text-xs font-bold hover:text-yellow-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">◀</button>
            <span className="text-white font-bold" style={{ fontSize: 'clamp(13px, 2vw, 22px)', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>⏱ {chronoTime}s</span>
            <button onClick={() => setChronoTime(prev => Math.min(30, prev + 1))} disabled={chronoTime >= 30} className="text-white text-xs font-bold hover:text-yellow-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">▶</button>
          </div>
          <h2 className="text-xl font-bold">Catégorie {category.id} - {category.name}</h2>
        </div>
        <div className="bg-white/90 rounded-b-lg p-6 shadow-xl">
          <div className="flex justify-center mb-4">
            <div className="w-32 h-24 relative">
              <Image src={category.image} alt={category.name} fill className="object-contain" />
            </div>
          </div>
          <h3 className="text-center text-gray-700 text-xl mb-4">اختر السلسلة - Choisissez une série</h3>

          {/* Bouton Mélange */}
          <div className="flex justify-center mb-4">
            <button
              onClick={() => onMelange(chronoTime)}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-all"
            >
              <span style={{ fontSize: 'clamp(18px, 2.5vw, 26px)' }}>🔀</span>
              <span>مزيج - Mélange</span>
            </button>
          </div>

          {existingSeries.length > 0 ? (
            <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
              {existingSeries.map((num) => (
                <button key={num} onClick={() => onSelectSeries(num, chronoTime)} className="w-12 h-12 rounded-full text-white font-bold text-lg hover:scale-110 transition-all shadow-lg" style={{ backgroundColor: category.color }}>{num}</button>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Aucune série disponible - لا توجد سلاسل متاحة</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== FONCTION PLEIN ÉCRAN =====
const enterFullscreen = () => {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if ((elem as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen) {
    (elem as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
  } else if ((elem as unknown as { msRequestFullscreen: () => void }).msRequestFullscreen) {
    (elem as unknown as { msRequestFullscreen: () => void }).msRequestFullscreen();
  }
};

const exitFullscreen = () => {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if ((document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen) {
    (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen();
  } else if ((document as unknown as { msExitFullscreen: () => void }).msExitFullscreen) {
    (document as unknown as { msExitFullscreen: () => void }).msExitFullscreen();
  }
};

// ===== COMPOSANT BOUTON PLEIN ÉCRAN =====
const FullscreenButton = () => {
  const [isFullscreen, setIsFullscreen] = useState(() => {
    // Initialiser selon l'état actuel au montage
    if (typeof document !== 'undefined') {
      return !!document.fullscreenElement;
    }
    return false;
  });

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    // Écouter tous les événements possibles
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('mozfullscreenchange', handleChange);
    document.addEventListener('MSFullscreenChange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('mozfullscreenchange', handleChange);
      document.removeEventListener('MSFullscreenChange', handleChange);
    };
  }, []);

  const toggleFullscreen = () => {
    // Vérifier l'état réel au moment du clic (pas le state)
    const currentlyFullscreen = !!document.fullscreenElement
      || !!(document as unknown as { webkitFullscreenElement: Element | null }).webkitFullscreenElement
      || !!(document as unknown as { mozFullScreenElement: Element | null }).mozFullScreenElement
      || !!(document as unknown as { msFullscreenElement: Element | null }).msFullscreenElement;

    if (currentlyFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  return (
    <button
      onClick={toggleFullscreen}
      className="absolute flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-80"
      style={{
        top: '8px',
        left: '8px',
        width: 'clamp(30px, 3vw, 45px)',
        height: 'clamp(30px, 3vw, 45px)',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 50,
      }}
      title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
    >
      {isFullscreen ? (
        // Icône quitter plein écran
        <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        // Icône plein écran
        <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}
    </button>
  );
};

// ===== ÉCRAN MOT DE PASSE (NOUVEAU DESIGN) =====
const PasswordScreen = ({ category, series, userCin, userPin, userPhoto, onSuccess, onBack }: { category: Category; series: number; userCin: string; userPin: string; userPhoto: string | null; onSuccess: () => void; onBack: () => void }) => {
  const [code, setCode] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [orientationChecked, setOrientationChecked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Détecter le mode plein écran
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
    };
  }, []);

  // Vérifier l'orientation de l'écran
  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Considérer comme mobile si la largeur est <= 900px
      const isMobileScreen = Math.min(width, height) <= 900;
      
      if (isMobileScreen) {
        // Sur mobile, vérifier si on est en paysage (largeur > hauteur)
        setIsLandscape(width > height);
      } else {
        // Sur desktop, toujours en mode paysage
        setIsLandscape(true);
      }
    };

    // Vérifier au chargement avec un petit délai pour laisser le temps au navigateur
    const initialCheck = setTimeout(() => {
      checkOrientation();
      setOrientationChecked(true);
    }, 100);

    // Écouter les changements d'orientation
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
      // Petit délai pour laisser le temps à l'orientation de changer
      setTimeout(checkOrientation, 100);
    });

    return () => {
      clearTimeout(initialCheck);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Précharger l'AudioContext au démarrage
  useEffect(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;
    } catch {
      // Audio not supported
    }
  }, []);

  // Précharger toutes les images de l'écran PIN
  useEffect(() => {
    const imagesToLoad = [
      '/images/pin-screen-bg.jpg',
      '/images/btn-fermer-new.png',
      '/images/btn-corriger.png',
      '/images/chif-display.jpg',
      '/images/chiffre-1.png',
      '/images/chiffre-2.png',
      '/images/chiffre-3.png',
      '/images/chiffre-4.png',
      '/images/chiffre-5.png',
      '/images/chiffre-6.png',
      '/images/chiffre-7.png',
      '/images/chiffre-8.png',
      '/images/chiffre-9.png',
      '/images/chiffre-0.png'
    ];
    
    let loadedCount = 0;
    const totalImages = imagesToLoad.length;
    
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalImages) {
        setImageLoaded(true);
      }
    };

    imagesToLoad.forEach((src) => {
      const img = new window.Image();
      img.onload = checkAllLoaded;
      img.onerror = () => {
        console.log(`Image not found: ${src}`);
        checkAllLoaded();
      };
      img.src = src;
    });
    
    // Timeout de sécurité - afficher l'écran après 2 secondes max
    const timeout = setTimeout(() => {
      setImageLoaded(true);
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, []);

  // Activer le plein écran et rotation horizontale automatiquement au chargement
  useEffect(() => {
    // Ne pas activer automatiquement le plein écran sur mobile pour éviter les problèmes
    const handleOrientationChange = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = Math.min(width, height) <= 900;
      const isLandscapeNow = width > height;
      
      if (isMobile && isLandscapeNow) {
        // Optionnel: essayer le plein écran
        const elem = document.documentElement;
        if (elem.requestFullscreen && !document.fullscreenElement) {
          elem.requestFullscreen().catch(() => {});
        }
      }
    };

    // Vérifier après que l'orientation a été détectée
    if (orientationChecked && isLandscape) {
      handleOrientationChange();
    }
  }, [orientationChecked, isLandscape]);

  // Redirection automatique quand 4 chiffres sont saisis
  useEffect(() => {
    if (code.length === 4) {
      const timer = setTimeout(() => {
        // Si PIN utilisateur vide → accepter tout
        // Si PIN rempli → vérifier
        if (!userPin || userPin === '' || code === userPin) {
          onSuccess();
        } else {
          setCode(""); // mauvais PIN → reset
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [code, onSuccess, userPin]);

  // Fonction pour jouer un son de clic
  const playClickSound = () => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 600;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio not supported
    }
  };

  const handleKeyPress = (num: string) => {
    if (code.length < 4) {
      playClickSound();
      setCode(prev => prev + num);
    }
  };

  const handleCorrect = () => {
    setCode("");
  };

  // Afficher un écran de chargement pendant la vérification de l'orientation
  if (!orientationChecked) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  // Afficher un écran noir si pas en mode paysage sur mobile
  if (!isLandscape) {
    const handleStartFullscreen = async () => {
      try {
        const elem = document.documentElement;
        
        // Demander le plein écran
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen) {
          await (elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        } else if ((elem as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen) {
          await (elem as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
        }
        
        // Essayer de verrouiller l'orientation en paysage
        if (screen.orientation && screen.orientation.lock) {
          try {
            await screen.orientation.lock('landscape');
          } catch {
            // Orientation lock not supported
          }
        }
      } catch {
        // Fullscreen not available
      }
    };

    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="text-center">
          {/* Icône téléphone animée */}
          <div className="mb-8 relative">
            <svg className="w-32 h-32 mx-auto text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {/* Flèche de rotation */}
            <div className="absolute -right-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-12 h-12 text-yellow-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          
          {/* Message en arabe */}
          <div className="text-white text-3xl font-bold mb-4" style={{ fontFamily: 'Arial, sans-serif' }}>
            🔄 دوّر الهاتف
          </div>
          
          {/* Message en français */}
          <div className="text-white text-xl mb-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            Tournez votre téléphone
          </div>
          
          {/* Instructions */}
          <div className="text-gray-400 text-lg mb-8">
            استخدم الوضع الأفقي
          </div>
          
          {/* Bouton pour activer plein écran */}
          <button
            onClick={handleStartFullscreen}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-4 px-8 rounded-xl text-xl shadow-lg transition-all transform hover:scale-105 active:scale-95"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>ابدأ الامتحان</span>
            </div>
            <div className="text-sm mt-1 opacity-80">Commencer le test</div>
          </button>
          
          {/* Note explicative */}
          <div className="mt-6 text-gray-500 text-sm max-w-xs mx-auto">
            ⚠️ cédez le téléphone en mode horizontal puis cliquez sur le bouton
          </div>
        </div>
      </div>
    );
  }

  // Afficher un écran de chargement pendant le chargement de l'image
  if (!imageLoaded) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 w-screen h-screen"
      style={{ 
        backgroundImage: 'url(/images/pin-screen-bg.jpg)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Bouton Plein Écran */}
      <FullscreenButton />

      {/* Photo de l'utilisateur */}
      {userPhoto && (
        <div
          className="absolute overflow-hidden"
          style={{
            top: isFullscreen ? '14%' : '11%',
            left: '18%',
            width: 'clamp(120px, 30vw, 450px)',
            height: 'clamp(88px, 22vw, 330px)',
            borderRadius: '12px',
            border: '2px solid transparent',
          }}
        >
          <img src={userPhoto} alt="Photo" className="w-full h-full object-cover" />
        </div>
      )}

      {/* N°CIN de l'utilisateur */}
      <div className="absolute flex items-center" style={{ top: '66%', left: '30%' }}>
        <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '1.8vw', fontWeight: 'bold', color: 'white' }}>
          {userCin.toUpperCase()}
        </span>
      </div>

      {/* Lettre de la catégorie - positionnée à côté de "Categorie" */}
      <div className="absolute flex items-center" style={{ top: 'clamp(72%, 75%, 75.5%)', left: '37%' }}>
        <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '1.56vw', fontWeight: 'bold', color: 'white' }}>
          {category.id}
        </span>
      </div>

      {/* Zone d'affichage du code PIN - 4 cases */}
      <div className="absolute flex" style={{ bottom: '29%', right: '13.5%', gap: '0.5vw' }}>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="relative" style={{ width: '3vw', height: '4.5vw' }}>
            {/* Image de fond avec la ligne rouge */}
            <Image
              src="/images/chif-display.jpg"
              alt={`digit-${index}`}
              fill
              className="object-contain"
              unoptimized
            />
            {/* Le chiffre entré */}
            {code[index] && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '2vw', fontWeight: 'bold', color: 'black' }}>
                  {code[index]}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chiffre 1 */}
      <button
        onClick={() => handleKeyPress('1')}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          top: '21%', 
          right: '26.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-1.png" 
          alt="1" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 2 */}
      <button
        onClick={() => handleKeyPress('2')}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          top: '21%', 
          right: '18.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-2.png" 
          alt="2" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 3 */}
      <button
        onClick={() => handleKeyPress('3')}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          top: '21%', 
          right: '10.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-3.png" 
          alt="3" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 4 */}
      <button
        onClick={() => handleKeyPress('4')}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          top: '31%', 
          right: '26.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-4.png" 
          alt="4" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 5 */}
      <button
        onClick={() => handleKeyPress('5')}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          top: '31%', 
          right: '18.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-5.png" 
          alt="5" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 6 */}
      <button
        onClick={() => handleKeyPress('6')}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          top: '31%', 
          right: '10.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-6.png" 
          alt="6" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 7 */}
      <button
        onClick={() => handleKeyPress('7')}
        className="absolute transition-transform duration-150 active:scale-90 z-10"
        style={{ 
          top: '40.5%', 
          right: '26.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-7.png" 
          alt="7" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 8 */}
      <button
        onClick={() => handleKeyPress('8')}
        className="absolute transition-transform duration-150 active:scale-90 z-10"
        style={{ 
          top: '40.5%', 
          right: '18.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-8.png" 
          alt="8" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 9 */}
      <button
        onClick={() => handleKeyPress('9')}
        className="absolute transition-transform duration-150 active:scale-90 z-10"
        style={{ 
          top: '40.5%', 
          right: '10.8%', 
          width: '5%',
          height: '11%'
        }}
      >
        <Image 
          src="/images/chiffre-9.png" 
          alt="9" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Chiffre 0 */}
      <button
        onClick={() => handleKeyPress('0')}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          top: '42.6%', 
          right: '11.3%', 
          width: '19.6%',
          height: '24.6%'
        }}
      >
        <Image 
          src="/images/chiffre-0.png" 
          alt="0" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Bouton Corriger - superposé sur l'image de fond */}
      <button
        onClick={handleCorrect}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          right: '13%', 
          bottom: '18%', 
          width: '15%',
          height: '10%'
        }}
      >
        <Image 
          src="/images/btn-corriger.png" 
          alt="Corriger" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>

      {/* Bouton Fermer - superposé sur l'image de fond */}
      <button
        onClick={onBack}
        className="absolute transition-transform duration-150 active:scale-90"
        style={{ 
          right: '15%', 
          bottom: '8%', 
          width: '10%',
          height: '10%'
        }}
      >
        <Image 
          src="/images/btn-fermer-new.png" 
          alt="Fermer" 
          fill
          className="object-contain"
          unoptimized
        />
      </button>
    </div>
  );
};

// ===== ÉCRAN COMPTEUR AVANT TEST =====
const CounterScreen = ({ category, series, onStart }: { category: Category; series: number; onStart: () => void }) => {
  const [countdown, setCountdown] = useState(5);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [orientationChecked, setOrientationChecked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);

  // Vérifier l'orientation de l'écran
  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobileScreen = Math.min(width, height) <= 900;
      
      if (isMobileScreen) {
        setIsLandscape(width > height);
      } else {
        setIsLandscape(true);
      }
    };

    const initialCheck = setTimeout(() => {
      checkOrientation();
      setOrientationChecked(true);
    }, 100);

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
      setTimeout(checkOrientation, 100);
    });

    return () => {
      clearTimeout(initialCheck);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Précharger l'image de fond
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(true);
    img.src = '/images/counter-bg.jpg';
  }, []);

  // Compte à rebours automatique
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      onStart();
    }
  }, [countdown, onStart]);

  // Afficher un écran de chargement pendant la vérification de l'orientation
  if (!orientationChecked) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  // Afficher un écran noir si pas en mode paysage sur mobile
  if (!isLandscape) {
    const handleStartFullscreen = async () => {
      try {
        const elem = document.documentElement;
        
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen) {
          await (elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        } else if ((elem as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen) {
          await (elem as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
        }
        
        if (screen.orientation && screen.orientation.lock) {
          try {
            await screen.orientation.lock('landscape');
          } catch {
            // Orientation lock not supported
          }
        }
      } catch {
        // Fullscreen not available
      }
    };

    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-8 relative">
            <svg className="w-32 h-32 mx-auto text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div className="absolute -right-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-12 h-12 text-yellow-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <div className="text-white text-3xl font-bold mb-4" style={{ fontFamily: 'Arial, sans-serif' }}>
            🔄 دوّر الهاتف
          </div>
          <div className="text-white text-xl mb-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            Tournez votre téléphone
          </div>
          <button
            onClick={handleStartFullscreen}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-4 px-8 rounded-xl text-xl shadow-lg transition-all transform hover:scale-105 active:scale-95"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>ابدأ الامتحان</span>
            </div>
            <div className="text-sm mt-1 opacity-80">Commencer le test</div>
          </button>
        </div>
      </div>
    );
  }

  // Afficher un écran de chargement pendant le chargement de l'image
  if (!imageLoaded) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 w-screen h-screen"
      style={{ 
        backgroundImage: 'url(/images/counter-bg.jpg)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <FullscreenButton />
    </div>
  );
};

// ===== ÉCRAN DE TEST =====
interface QuestionData {
  id: string;
  order: number;
  image: string;
  audio: string;
  video: string | null;
  duration: number;
  responses: { id: string; order: number; text: string; isCorrect: boolean }[];
}

const TestScreen = ({ category, series, chronoTime, melangeQuestions, user, onFinish, onBack }: { category: Category; series: number; chronoTime: number; melangeQuestions?: QuestionData[]; user: UserData | null; onFinish: (result: { questions: QuestionData[]; userAnswers: number[][]; score: number; total: number }) => void; onBack: () => void }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [orientationChecked, setOrientationChecked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [correcting, setCorrecting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [allUserAnswers, setAllUserAnswers] = useState<number[][]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<'min' | 'med' | 'max'>('max');
  const [countdown, setCountdown] = useState(chronoTime);
  const [chronoActive, setChronoActive] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Charger les questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        if (melangeQuestions && melangeQuestions.length > 0) {
          // Questions mélangées déjà fournies
          setQuestions(melangeQuestions);
        } else {
          const res = await fetch(`/api/questions?category=${category.id}&serie=${series}`);
          if (!res.ok) {
            console.error('Error loading questions:', res.status, res.statusText);
            return;
          }
          const data = await res.json();
          if (data.questions) {
            // Mélanger les questions au hasard (Fisher-Yates)
            const shuffled = [...data.questions];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setQuestions(shuffled);
          }
        }
      } catch (error) {
        console.error('Error loading questions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [category.id, series]);

  // Volume toggle-off: click active button to deactivate it
  const handleVolumeClick = (level: 'min' | 'med' | 'max') => {
    if (level === 'min') {
      if (!isMuted && volumeLevel === 'min') {
        // Min active + click min → all off (mute)
        setIsMuted(true);
      } else {
        // Set to min
        setIsMuted(false);
        setVolumeLevel('min');
      }
    } else if (level === 'med') {
      if (!isMuted && volumeLevel === 'med') {
        // Med active + click med → toggle off, keep min
        setVolumeLevel('min');
      } else {
        // Set to med
        setIsMuted(false);
        setVolumeLevel('med');
      }
    } else if (level === 'max') {
      if (!isMuted && volumeLevel === 'max') {
        // Max active + click max → toggle off, keep min+med
        setVolumeLevel('med');
      } else {
        // Set to max
        setIsMuted(false);
        setVolumeLevel('max');
      }
    }
  };

  const volumeLevelForDisplay = isMuted ? 'off' : volumeLevel;

  // Son d'alerte simple (3 beeps rapides)
  const playAlertSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      [0, 0.12, 0.24].forEach(delay => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.06);
        oscillator.start(ctx.currentTime + delay);
        oscillator.stop(ctx.currentTime + delay + 0.3);
      });
    } catch {
      // Audio not supported
    }
  };

  // Jouer l'audio de la question actuelle (volumeLevel/isMuted removed from deps to avoid restart)
  useEffect(() => {
    if (questions.length > 0 && questions[currentQuestion]?.audio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const audio = new Audio(questions[currentQuestion].audio);
      audio.muted = isMuted;
      audio.volume = isMuted ? 0 : volumeLevel === 'min' ? 0.3 : volumeLevel === 'med' ? 0.6 : 1;
      
      // Stopper le chrono en cours
      setChronoActive(false);
      setAudioPlaying(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCountdown(chronoTime);
      
      // Démarrer le chrono quand l'audio se termine
      audio.onended = () => {
        setAudioPlaying(false);
        setChronoActive(true);
        setCountdown(chronoTime);
        timerRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              // Auto-valider quand le chrono arrive à 0
              setTimeout(() => handleNextForChrono(), 100);
              return 0;
            }
            if (prev === 6) {
              // Son d'alerte quand on passe à 5s
              playAlertSound();
            }
            return prev - 1;
          });
        }, 1000);
      };
      
      audioRef.current = audio;
      audio.play().catch(() => {
        // Si l'audio ne peut pas jouer, démarrer le chrono directement
        setAudioPlaying(false);
        setChronoActive(true);
        setCountdown(chronoTime);
        timerRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              setTimeout(() => handleNextForChrono(), 100);
              return 0;
            }
            if (prev === 6) {
              playAlertSound();
            }
            return prev - 1;
          });
        }, 1000);
      });
    } else if (questions.length > 0 && !questions[currentQuestion]?.audio) {
      // Pas d'audio → démarrer le chrono directement
      setChronoActive(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCountdown(chronoTime);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setTimeout(() => handleNextForChrono(), 100);
            return 0;
          }
          if (prev === 6) {
            playAlertSound();
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [questions, currentQuestion]);

  // Appliquer mute/unmute + volume en temps réel
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = isMuted ? 0 : volumeLevel === 'min' ? 0.3 : volumeLevel === 'med' ? 0.6 : 1;
    }
  }, [isMuted, volumeLevel]);

  // Stop la série → calculer le score et afficher l'écran résultat
  const handleStopAndExit = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setChronoActive(false);

    // Sauvegarder la réponse en cours
    const finalAnswers = [...allUserAnswers];
    finalAnswers[currentQuestion] = [...selectedAnswers];

    // Calculer le score
    let correctCount = 0;
    questions.forEach((q, idx) => {
      const userAns = finalAnswers[idx] || [];
      const correctResp = q.responses.filter(r => r.isCorrect).map(r => r.order).sort();
      const userSorted = [...userAns].sort();
      if (JSON.stringify(userSorted) === JSON.stringify(correctResp)) {
        correctCount++;
      }
    });

    onFinish({
      questions: questions,
      userAnswers: finalAnswers,
      score: correctCount,
      total: questions.length
    });
  };

  // Précharger les images des boutons
  useEffect(() => {
    const buttons = [
      '/images/btn-correct.webp', '/images/btn-correct-active.webp',
      '/images/btn-1-inactive.webp', '/images/btn-1-active.webp',
      '/images/btn-2-inactive.webp', '/images/btn-2-active.webp',
      '/images/btn-3-inactive.webp', '/images/btn-3-active.webp',
      '/images/btn-4-inactive.webp', '/images/btn-4-active.webp',
      '/images/btn-valide.webp', '/images/btn-valide-active.webp',
    ];
    buttons.forEach(src => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  // Précharger les images des boutons + détecter mobile
  const isMobileRef = useRef(false);

  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = Math.min(window.innerWidth, window.innerHeight) <= 900;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Vérifier l'orientation de l'écran
  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobileScreen = Math.min(width, height) <= 900;
      
      if (isMobileScreen) {
        setIsLandscape(width > height);
      } else {
        setIsLandscape(true);
      }
    };

    const initialCheck = setTimeout(() => {
      checkOrientation();
      setOrientationChecked(true);
    }, 100);

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
      setTimeout(checkOrientation, 100);
    });

    return () => {
      clearTimeout(initialCheck);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Précharger l'image de fond
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(true);
    img.src = '/images/test-screen-bg.png';
  }, []);

  // Gérer la sélection de réponse
  const handleSelectAnswer = (answerOrder: number) => {
    setSelectedAnswers((prev) => {
      if (prev.includes(answerOrder)) {
        return prev.filter((a) => a !== answerOrder);
      }
      return [...prev, answerOrder];
    });
  };

  // Passer à la question suivante
  const handleNext = () => {
    // Arrêter le chrono
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setChronoActive(false);
    
    // Sauvegarder la réponse de la question actuelle
    setAllUserAnswers((prev) => {
      const updated = [...prev];
      updated[currentQuestion] = [...selectedAnswers];
      return updated;
    });
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setSelectedAnswers([]);
    } else {
      // Dernière question - sauvegarder et finir
      const finalAnswers = [...allUserAnswers];
      finalAnswers[currentQuestion] = [...selectedAnswers];
      // Calculer le score
      let correctCount = 0;
      questions.forEach((q, idx) => {
        const userAns = finalAnswers[idx] || [];
        const correctResp = q.responses.filter(r => r.isCorrect).map(r => r.order).sort();
        const userSorted = userAns.sort();
        if (JSON.stringify(userSorted) === JSON.stringify(correctResp)) {
          correctCount++;
        }
      });
      // Stopper l'avant de finir
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      onFinish({
        questions: questions,
        userAnswers: finalAnswers,
        score: correctCount,
        total: questions.length
      });
    }
  };

  // Auto-validation par le chrono (utilise les refs pour éviter les stale closures)
  const selectedAnswersRef = useRef(selectedAnswers);
  const currentQuestionRef = useRef(currentQuestion);
  const allUserAnswersRef = useRef(allUserAnswers);
  const questionsRef = useRef(questions);

  useEffect(() => { selectedAnswersRef.current = selectedAnswers; }, [selectedAnswers]);
  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  useEffect(() => { allUserAnswersRef.current = allUserAnswers; }, [allUserAnswers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const handleNextForChrono = () => {
    // Arrêter le chrono
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setChronoActive(false);

    const curQ = currentQuestionRef.current;
    const selAns = selectedAnswersRef.current;
    const allAns = allUserAnswersRef.current;
    const qs = questionsRef.current;

    // Sauvegarder la réponse
    const updatedAnswers = [...allAns];
    updatedAnswers[curQ] = [...selAns];

    if (curQ < qs.length - 1) {
      setAllUserAnswers(updatedAnswers);
      setCurrentQuestion(curQ + 1);
      setSelectedAnswers([]);
    } else {
      // Dernière question
      let correctCount = 0;
      qs.forEach((q, idx) => {
        const userAns = updatedAnswers[idx] || [];
        const correctResp = q.responses.filter(r => r.isCorrect).map(r => r.order).sort();
        const userSorted = [...userAns].sort();
        if (JSON.stringify(userSorted) === JSON.stringify(correctResp)) {
          correctCount++;
        }
      });
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      onFinish({
        questions: qs,
        userAnswers: updatedAnswers,
        score: correctCount,
        total: qs.length
      });
    }
  };

  // Nettoyer le chrono au démontage
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Afficher un écran de chargement pendant la vérification de l'orientation
  if (!orientationChecked) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  // Afficher un écran noir si pas en mode paysage sur mobile
  if (!isLandscape) {
    const handleStartFullscreen = async () => {
      try {
        const elem = document.documentElement;
        
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen) {
          await (elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        } else if ((elem as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen) {
          await (elem as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
        }
        
        if (screen.orientation && screen.orientation.lock) {
          try {
            await screen.orientation.lock('landscape');
          } catch {
            // Orientation lock not supported
          }
        }
      } catch {
        // Fullscreen not available
      }
    };

    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-8 relative">
            <svg className="w-32 h-32 mx-auto text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div className="absolute -right-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-12 h-12 text-yellow-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <div className="text-white text-3xl font-bold mb-4" style={{ fontFamily: 'Arial, sans-serif' }}>
            🔄 دوّر الهاتف
          </div>
          <div className="text-white text-xl mb-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            Tournez votre téléphone
          </div>
          <button
            onClick={handleStartFullscreen}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-4 px-8 rounded-xl text-xl shadow-lg transition-all transform hover:scale-105 active:scale-95"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>ابدأ الامتحان</span>
            </div>
            <div className="text-sm mt-1 opacity-80">Commencer le test</div>
          </button>
        </div>
      </div>
    );
  }

  // Afficher un écran de chargement pendant le chargement des questions
  if (loading || !imageLoaded) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-sm">Chargement des questions...</p>
        </div>
      </div>
    );
  }

  // Si pas de questions
  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-2xl mb-4">⚠️ Aucune question trouvée</p>
          <button onClick={handleStopAndExit} className="bg-red-500 px-6 py-2 rounded-lg">Retour</button>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div 
      className="fixed inset-0 w-screen h-screen"
      style={{ 
        backgroundImage: 'url(/images/test-screen-bg.png)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Bouton Plein Écran */}
      <FullscreenButton />

      {/* Nom prénom utilisateur - Français */}
      {user && (
        <span
          className="absolute"
          style={{
            bottom: '14.2%',
            right: '4%',
            zIndex: 20,
            fontSize: 'clamp(9px, 1.3vw, 15px)',
            color: '#DC143C',
            fontWeight: 'bold',
          }}
        >
          {user.prenomFr || ''} {user.nomFr || ''}
        </span>
      )}
      {/* Nom prénom utilisateur - Arabe */}
      {user && (user.prenomAr || user.nomAr) && (
        <div
          dir="rtl"
          className="absolute"
          style={{
            bottom: '9.6%',
            right: '12%',
            zIndex: 20,
            fontSize: 'clamp(9px, 1.3vw, 15px)',
            color: '#DC143C',
            fontWeight: 'bold',
          }}
        >
          {user.prenomAr || ''} {user.nomAr || ''}
        </div>
      )}

      {/* Zone noire pour afficher l'image/vidéo de la question */}
      <div
        className="absolute bg-black border-[6px] border-white"
        style={{
          top: '7%',
          left: '3.5%',
          width: '73%',
          height: '77%'
        }}
      >
        {question.video ? (
          <video
            key={question.video}
            src={question.video}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-contain"
          />
        ) : question.image ? (
          <Image
            src={question.image}
            alt={`Question ${question.order}`}
            fill
            className="object-contain"
            unoptimized
          />
        ) : null}
      </div>

      {/* Bouton Corriger - indépendant */}
      <div className="absolute flex items-center justify-center" style={{ top: '22%', right: '5.5%', zIndex: 20, width: 'clamp(70px,11vw,170px)' }}>
        <div className="relative" style={{ pointerEvents: 'none' }}>
          <img src={correcting ? "/images/btn-correct-active.webp" : "/images/btn-correct.webp"}
            alt="Corriger" className="w-[clamp(70px,11vw,170px)] h-[clamp(55px,5vw,140px)] object-contain" />
          <div
            className="absolute rounded-full"
            style={{ top: '25%', left: '25%', width: '50%', height: '45%', pointerEvents: 'auto' }}
            onClick={() => {
              setCorrecting(true);
              setSelectedAnswers([]);
              setTimeout(() => setCorrecting(false), 500);
            }}
          />
        </div>
      </div>

      {/* Bouton 1 - indépendant */}
      <div className="absolute flex items-center justify-center" style={{ top: '29%', right: '5.5%', zIndex: 20, width: 'clamp(70px,11vw,170px)' }}>
        <div className="relative" style={{ pointerEvents: 'none' }}>
          <img src={selectedAnswers.includes(1) ? '/images/btn-1-active.webp' : '/images/btn-1-inactive.webp'}
            alt="Bouton 1" className="w-[clamp(55px,7vw,140px)] h-[clamp(55px,7vw,140px)] object-contain" />
          <div
            className="absolute rounded-full"
            style={{ top: '30%', left: '25%', width: '50%', height: '50%', pointerEvents: 'auto' }}
            onClick={() => handleSelectAnswer(1)}
          />
        </div>
      </div>

      {/* Bouton 2 - indépendant */}
      <div className="absolute flex items-center justify-center" style={{ top: '36.5%', right: '5.5%', zIndex: 20, width: 'clamp(70px,11vw,170px)' }}>
        <div className="relative" style={{ pointerEvents: 'none' }}>
          <img src={selectedAnswers.includes(2) ? '/images/btn-2-active.webp' : '/images/btn-2-inactive.webp'}
            alt="Bouton 2" className="w-[clamp(55px,7vw,140px)] h-[clamp(55px,7vw,140px)] object-contain" />
          <div
            className="absolute rounded-full"
            style={{ top: '30%', left: '25%', width: '50%', height: '50%', pointerEvents: 'auto' }}
            onClick={() => handleSelectAnswer(2)}
          />
        </div>
      </div>

      {/* Bouton 3 - indépendant */}
      <div className="absolute flex items-center justify-center" style={{ top: '44.5%', right: '5.5%', zIndex: 20, width: 'clamp(70px,11vw,170px)' }}>
        <div className="relative" style={{ pointerEvents: 'none' }}>
          <img src={selectedAnswers.includes(3) ? '/images/btn-3-active.webp' : '/images/btn-3-inactive.webp'}
            alt="Bouton 3" className="w-[clamp(55px,7vw,140px)] h-[clamp(55px,7vw,140px)] object-contain" />
          <div
            className="absolute rounded-full"
            style={{ top: '30%', left: '25%', width: '50%', height: '50%', pointerEvents: 'auto' }}
            onClick={() => handleSelectAnswer(3)}
          />
        </div>
      </div>

      {/* Bouton 4 - indépendant */}
      <div className="absolute flex items-center justify-center" style={{ top: '52.5%', right: '5.5%', zIndex: 20, width: 'clamp(70px,11vw,170px)' }}>
        <div className="relative" style={{ pointerEvents: 'none' }}>
          <img src={selectedAnswers.includes(4) ? '/images/btn-4-active.webp' : '/images/btn-4-inactive.webp'}
            alt="Bouton 4" className="w-[clamp(55px,7vw,140px)] h-[clamp(55px,7vw,140px)] object-contain" />
          <div
            className="absolute rounded-full"
            style={{ top: '30%', left: '25%', width: '50%', height: '50%', pointerEvents: 'auto' }}
            onClick={() => handleSelectAnswer(4)}
          />
        </div>
      </div>

      {/* Affichage des réponses sélectionnées 1-2-3-4 en haut à droite */}
      <div className="absolute flex items-center" style={{ top: '13%', right: '5.5%', zIndex: 20, gap: 'clamp(4px, 0.7vw, 32px)' }}>
        {[1, 2, 3, 4].map((num) => (
          <span
            key={num}
            className="font-normal text-center"
            style={{
              fontSize: 'clamp(18px, 2.5vw, 36px)',
              color: '#b91c1c',
              opacity: selectedAnswers.includes(num) ? 1 : 0,
              transition: 'opacity 0.2s',
              minWidth: 'clamp(18px, 2.5vw, 36px)',
              lineHeight: 1,
            }}
          >
            {num}
          </span>
        ))}
      </div>

      {/* Bouton Valider - indépendant */}
      <div className="absolute flex items-center justify-center" style={{ top: '64.5%', right: '5.5%', zIndex: 20, width: 'clamp(70px,11vw,170px)' }}>
        <div className="relative" style={{ pointerEvents: 'none' }}>
          <img src={validating ? "/images/btn-valide-active.webp" : "/images/btn-valide.webp"}
            alt="Valider" className="w-[clamp(70px,11vw,170px)] h-[clamp(55px,5vw,140px)] object-contain" />
          <div
            className="absolute rounded-full"
            style={{ top: '30%', left: '25%', width: '50%', height: '50%', pointerEvents: audioPlaying ? 'none' : 'auto', cursor: audioPlaying ? 'not-allowed' : 'pointer' }}
            onClick={() => {
              if (audioPlaying) return;
              setValidating(true);
              setTimeout(() => {
                setValidating(false);
                handleNext();
              }, 500);
            }}
          />
        </div>
      </div>

      {/* Numéro de question et progression */}
      {/* Question counter removed from background */}

      {/* Chrono */}
      {chronoActive && (
        <div
          className="absolute font-normal"
          style={{
            top: '87%',
            left: '25%',
            fontSize: 'clamp(20px, 3vw, 40px)',
            color: countdown <= 5 ? '#ef4444' : '#22c55e',
            zIndex: 20,
          }}
        >
          {countdown}s
        </div>
      )}

      {/* Numéro de la question en cours */}
      <div
        className="absolute font-normal"
        style={{
          top: '86%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 'clamp(28px, 4vw, 55px)',
          color: '#22c55e',
          zIndex: 20,
        }}
      >
        {currentQuestion + 1}
      </div>

      {/* Type catégorie en rouge */}
      <div
        className="absolute font-normal"
        style={{
          top: '90%',
          left: '89%',
          fontSize: 'clamp(16px, 2vw, 30px)',
          color: '#ef4444',
          zIndex: 20,
        }}
      >
        {category.id}
      </div>

      {/* Boutons Volume */}
      {question.audio && (
        <div className="absolute flex items-center gap-1" style={{ top: '87.5%', left: '66%', zIndex: 20 }}>
          {/* Volume Min */}
          <div className="relative" style={{ pointerEvents: 'none' }}>
            <img
              src={(volumeLevelForDisplay === 'min' || volumeLevelForDisplay === 'med' || volumeLevelForDisplay === 'max') ? '/images/btn-volume-max.png' : '/images/btn-volume-min.png'}
              alt="Volume min"
              className="w-[clamp(30px,3.5vw,50px)] h-[clamp(30px,3.5vw,50px)] object-contain cursor-pointer"
              style={{ pointerEvents: 'auto' }}
              onClick={() => handleVolumeClick('min')}
            />
          </div>
          {/* Volume Med */}
          <div className="relative" style={{ pointerEvents: 'none' }}>
            <img
              src={(volumeLevelForDisplay === 'med' || volumeLevelForDisplay === 'max') ? '/images/btn-volume-max.png' : '/images/btn-volume-min.png'}
              alt="Volume moyen"
              className="w-[clamp(30px,3.5vw,50px)] h-[clamp(30px,3.5vw,50px)] object-contain cursor-pointer"
              style={{ pointerEvents: 'auto' }}
              onClick={() => handleVolumeClick('med')}
            />
          </div>
          {/* Volume Max */}
          <div className="relative" style={{ pointerEvents: 'none' }}>
            <img
              src={volumeLevelForDisplay === 'max' ? '/images/btn-volume-max.png' : '/images/btn-volume-min.png'}
              alt="Volume max"
              className="w-[clamp(30px,3.5vw,50px)] h-[clamp(30px,3.5vw,50px)] object-contain cursor-pointer"
              style={{ pointerEvents: 'auto' }}
              onClick={() => handleVolumeClick('max')}
            />
          </div>
        </div>
      )}

      {/* Bouton Stop en haut à droite de l'écran */}
      <div className="absolute group" style={{ top: '1%', right: '1%' }}>
        <button
          onClick={handleStopAndExit}
          className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center justify-center"
          style={{
            width: 'clamp(30px, 3vw, 45px)',
            height: 'clamp(30px, 3vw, 45px)'
          }}
        >
          <div style={{ fontSize: 'clamp(16px, 2vw, 24px)' }}>⏹</div>
        </button>
        {/* Info tooltip au survol */}
        <div 
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 text-white rounded px-3 py-2 pointer-events-none"
          style={{ 
            top: '100%', 
            right: '0', 
            marginTop: '4px',
            fontSize: 'clamp(10px, 1vw, 12px)',
            maxWidth: '200px'
          }}
        >
          <div className="font-bold mb-1">⏹ Arrêter la série</div>
          <div>Permet de quitter la série d&apos;entraînement</div>
          <div className="mt-1 text-yellow-300 text-xs">⚠️ Non disponible à l&apos;examen réel</div>
          <div dir="rtl" className="mt-1 text-yellow-300 text-xs">⚠️ غير متوفر في الامتحان الحقيقي</div>
        </div>
      </div>
    </div>
  );
};

// ===== ÉCRAN RÉSULTAT =====
const ResultScreen = ({ score, total, onRestart, onHome, onCorrection }: { score: number; total: number; onRestart: () => void; onHome: () => void; onCorrection: () => void }) => {
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 75;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 flex items-center justify-center p-4">
      <FullscreenButton />
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
          <span className={`text-4xl ${passed ? 'text-green-500' : 'text-red-500'}`}>{passed ? '✓' : '✗'}</span>
        </div>
        <h1 className={`text-2xl font-bold mb-2 ${passed ? 'text-green-600' : 'text-red-600'}`}>{passed ? 'ناجح - RÉUSSI !' : 'راسب - NON RÉUSSI'}</h1>
        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <p className="text-3xl font-bold text-gray-800">{score}/{total}</p>
          <p className="text-xl text-gray-600">{percentage}%</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onHome} className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-bold hover:bg-gray-600">🏠 Accueil</button>
          <button onClick={onRestart} className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600">🔄 Recommencer</button>
        </div>
        <button onClick={onCorrection} className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 text-lg">📋 تصحيح - Voir les corrections</button>
      </div>
    </div>
  );
};

// ===== ÉCRAN CORRECTION =====
const CorrectionScreen = ({ questions, userAnswers, onBack }: { questions: QuestionData[]; userAnswers: number[][]; onBack: () => void }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const question = questions[currentIdx];
  const userAns = userAnswers[currentIdx] || [];
  const correctResp = question.responses.filter(r => r.isCorrect).map(r => r.order);

  const handlePrev = () => {
    if (currentIdx > 0) {
      stopAudio();
      setCurrentIdx(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      stopAudio();
      setCurrentIdx(prev => prev + 1);
    }
  };

  const toggleAudio = () => {
    if (!question.audio) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current = new Audio(question.audio);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  // Question is correct?
  const isCorrect = JSON.stringify([...userAns].sort()) === JSON.stringify([...correctResp].sort());

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gray-900 flex flex-col">
      {/* Bouton Plein Écran */}
      <FullscreenButton />

      {/* Header */}
      <div className="flex items-center justify-between px-[2vw] py-[1vh] bg-gray-800 shrink-0">
        <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white px-[2vw] py-[0.5vh] rounded font-bold" style={{ fontSize: 'clamp(11px, 1.3vw, 16px)' }}>
          ← الرجوع
        </button>
        <div className="text-white font-bold" style={{ fontSize: 'clamp(12px, 1.4vw, 18px)' }}>
          سؤال {currentIdx + 1} / {questions.length}
        </div>
        <div className={`rounded-full flex items-center justify-center text-white font-bold ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: 'clamp(24px, 3vw, 36px)', height: 'clamp(24px, 3vw, 36px)', fontSize: 'clamp(11px, 1.3vw, 16px)' }}>
          {isCorrect ? '✓' : '✗'}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question image - takes most space */}
        <div className="flex-1 relative bg-black m-[0.5vw]">
          {question.video ? (
            <video
              key={question.video}
              src={question.video}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          ) : question.image && (
            <Image
              src={question.image}
              alt={`Question ${currentIdx + 1}`}
              fill
              className="object-contain"
              unoptimized
            />
          )}
          {/* Audio button - top left */}
          {question.audio && (
            <button
              onClick={toggleAudio}
              className="absolute rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
              style={{ top: '4%', left: '4%', width: 'clamp(28px, 3.5vw, 44px)', height: 'clamp(28px, 3.5vw, 44px)', fontSize: 'clamp(14px, 1.8vw, 22px)' }}
            >
              {isPlaying ? '⏹' : '🔊'}
            </button>
          )}
        </div>

        {/* Answers panel - right side */}
        <div className="flex flex-col items-center justify-center gap-[clamp(6px,1.5vh,24px)] py-[1vh] shrink-0" style={{ width: 'clamp(55px, 12vw, 200px)' }}>
          {/* Correct answers */}
          <div className="text-center w-full">
            <div className="text-green-400 font-bold mb-[clamp(2px,0.6vh,10px)]" style={{ fontSize: 'clamp(9px, 1.4vw, 22px)' }}>الإجابة الصحيحة</div>
            <div className="text-gray-400 mb-[clamp(2px,0.6vh,10px)]" style={{ fontSize: 'clamp(7px, 1vw, 18px)' }}>Réponse correcte</div>
            <div className="flex flex-col gap-[clamp(3px,0.6vh,10px)] items-center">
              {[1, 2, 3, 4].map((num) => {
                const isCorrectAnswer = correctResp.includes(num);
                return (
                  <div
                    key={num}
                    className={`rounded-full flex items-center justify-center text-white font-bold transition-all ${
                      isCorrectAnswer
                        ? 'bg-green-500 shadow-lg shadow-green-500/30'
                        : 'bg-gray-700/60'
                    }`}
                    style={{ width: 'clamp(24px, 5vh, 110px)', height: 'clamp(24px, 5vh, 110px)', fontSize: 'clamp(10px, 2.2vh, 44px)' }}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Separator */}
          <div className="bg-gray-600" style={{ width: 'clamp(20px, 5vw, 55px)', height: '1px' }}></div>

          {/* User answers */}
          <div className="text-center w-full">
            <div className="text-blue-400 font-bold mb-[clamp(2px,0.6vh,10px)]" style={{ fontSize: 'clamp(9px, 1.4vw, 22px)' }}>إجابتك</div>
            <div className="text-gray-400 mb-[clamp(2px,0.6vh,10px)]" style={{ fontSize: 'clamp(7px, 1vw, 18px)' }}>Votre réponse</div>
            <div className="flex flex-col gap-[clamp(3px,0.6vh,10px)] items-center">
              {[1, 2, 3, 4].map((num) => {
                const isUserAnswer = userAns.includes(num);
                const isAlsoCorrect = correctResp.includes(num);
                return (
                  <div
                    key={num}
                    className={`rounded-full flex items-center justify-center font-bold transition-all ${
                      isUserAnswer
                        ? isAlsoCorrect
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                          : 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-gray-700/60 text-gray-500'
                    }`}
                    style={{ width: 'clamp(24px, 5vh, 110px)', height: 'clamp(24px, 5vh, 110px)', fontSize: 'clamp(10px, 2.2vh, 44px)' }}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Navigation */}
      <div className="flex items-center justify-between px-[2vw] py-[1vh] bg-gray-800 shrink-0">
        <button
          onClick={handlePrev}
          disabled={currentIdx === 0}
          className="bg-gray-600 hover:bg-gray-500 disabled:opacity-30 text-white rounded-lg font-bold transition-colors px-[2.5vw] py-[0.8vh]"
          style={{ fontSize: 'clamp(11px, 1.2vw, 16px)' }}
        >
          ← السابق
        </button>
        
        {/* Question dots */}
        <div className="flex gap-[2px] overflow-x-auto px-[1vw]" style={{ maxWidth: '50vw' }}>
          {questions.map((_, idx) => {
            const uAns = userAnswers[idx] || [];
            const cResp = questions[idx].responses.filter(r => r.isCorrect).map(r => r.order);
            const correct = JSON.stringify([...uAns].sort()) === JSON.stringify([...cResp].sort());
            return (
              <button
                key={idx}
                onClick={() => { stopAudio(); setCurrentIdx(idx); }}
                className={`rounded-full flex items-center justify-center font-bold shrink-0 transition-all ${
                  idx === currentIdx
                    ? correct
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                    : correct
                      ? 'bg-green-500/40 text-green-300'
                      : 'bg-red-500/40 text-red-300'
                }`}
                style={{ width: idx === currentIdx ? 'clamp(20px, 2.5vw, 30px)' : 'clamp(18px, 2vw, 26px)', height: idx === currentIdx ? 'clamp(20px, 2.5vw, 30px)' : 'clamp(18px, 2vw, 26px)', fontSize: 'clamp(7px, 0.9vw, 11px)' }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNext}
          disabled={currentIdx === questions.length - 1}
          className="bg-gray-600 hover:bg-gray-500 disabled:opacity-30 text-white rounded-lg font-bold transition-colors px-[2.5vw] py-[0.8vh]"
          style={{ fontSize: 'clamp(11px, 1.2vw, 16px)' }}
        >
          التالي →
        </button>
      </div>
    </div>
  );
};

// ===== PANEL ADMIN =====
type AdminTab = 'import' | 'series' | 'users' | 'admins';

interface QuestionView {
  id: string;
  order: number;
  image: string;
  audio: string;
  video: string | null;
  responses: { order: number; isCorrect: boolean }[];
}

// ===== ÉCRAN PROFIL UTILISATEUR =====
const UserProfileScreen = ({ user, onBack, onLogout }: { user: UserData; onBack: () => void; onLogout: () => void }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) { setMessage('Remplissez tous les champs'); setMsgType('error'); return; }
    if (newPassword.length < 4) { setMessage('Le mot de passe doit avoir au moins 4 caractères'); setMsgType('error'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.cin}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || 'Erreur'); setMsgType('error'); return; }
      setMessage('Mot de passe modifié ✓'); setMsgType('success');
      setOldPassword(''); setNewPassword('');
    } catch { setMessage('Erreur serveur'); setMsgType('error'); }
    finally { setLoading(false); }
  };

  const handleChangePin = async () => {
    if (newPin.length !== 4 && newPin !== '') { setMessage('Le PIN doit avoir exactement 4 chiffres (ou laisser vide)'); setMsgType('error'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.cin}/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || 'Erreur'); setMsgType('error'); return; }
      setMessage(newPin ? `PIN changé en ${newPin} ✓` : 'PIN supprimé (accès libre) ✓'); setMsgType('success');
      setNewPin('');
    } catch { setMessage('Erreur serveur'); setMsgType('error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 p-4">
      <FullscreenButton />
      <div className="max-w-lg mx-auto">
        <div className="bg-gray-500 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
          <button onClick={onBack} className="bg-gray-600 hover:bg-gray-700 px-4 py-1 rounded font-bold">← Retour</button>
          <h2 className="text-xl font-bold">⚙️ Mon Profil</h2>
          <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm font-bold">❌</button>
        </div>
        <div className="bg-white/90 rounded-b-lg p-6 shadow-xl space-y-6">
          {/* Info utilisateur */}
          <div className="flex items-center gap-4 pb-4 border-b">
            {user.photo ? (
              <img src={user.photo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-gray-300" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center text-2xl">👤</div>
            )}
            <div>
              <p className="font-bold text-gray-800 text-lg">{user.prenomFr} {user.nomFr}</p>
              <p className="text-gray-600 text-sm" dir="rtl">{user.prenomAr} {user.nomAr}</p>
              <p className="text-gray-500 text-xs mt-1">N°CIN: {user.cin} | Catégorie: {user.permisCategory === 'ALL' ? 'Toutes' : user.permisCategory}</p>
              {user.examDate && <p className="text-blue-600 text-xs">📅 Examen: {user.examDate}</p>}
            </div>
          </div>

          {message && (
            <div className={`px-4 py-2 rounded-lg text-center text-sm font-bold ${msgType === 'success' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
              {message}
            </div>
          )}

          {/* Changer mot de passe */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">🔐 Changer le mot de passe</h3>
            <input type="password" placeholder="Ancien mot de passe" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
            <input type="password" placeholder="Nouveau mot de passe" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
            <button onClick={handleChangePassword} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold disabled:opacity-50">Modifier le mot de passe</button>
          </div>

          {/* Changer PIN */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">🔑 Code PIN ({user.pinCode ? user.pinCode : 'Non défini — accès libre'})</h3>
            <p className="text-gray-500 text-xs">Laissez vide si vous voulez supprimer le PIN (accès libre à l&apos;écran PIN)</p>
            <input type="text" maxLength={4} placeholder="Nouveau PIN (4 chiffres)" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
            <button onClick={handleChangePin} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold disabled:opacity-50">Modifier le PIN</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== PANNEAU ADMIN =====
const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('import');
  const [category, setCategory] = useState<string>('A');
  const [serie, setSerie] = useState<number>(1);
  const [seriesData, setSeriesData] = useState<{ category: string; serie: number; questions: number }[]>([]);

  // Users management states
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [formCin, setFormCin] = useState('');
  const [formNomFr, setFormNomFr] = useState('');
  const [formPrenomFr, setFormPrenomFr] = useState('');
  const [formNomAr, setFormNomAr] = useState('');
  const [formPrenomAr, setFormPrenomAr] = useState('');
  const [formCategory, setFormCategory] = useState('B');
  const [formExamDate, setFormExamDate] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [formPhotoOriginalSize, setFormPhotoOriginalSize] = useState(0);
  const [formPhotoUploading, setFormPhotoUploading] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formMsgType, setFormMsgType] = useState<'success' | 'error'>('success');

  const resetUserForm = () => {
    setFormCin(''); setFormNomFr(''); setFormPrenomFr(''); setFormNomAr('');
    setFormPrenomAr(''); setFormCategory('B'); setFormExamDate(''); setFormPin('');
    setFormPassword(''); setFormPhoto(null); setFormPhotoFile(null);
    setFormPhotoOriginalSize(0); setFormPhotoUploading(false); setFormMessage(''); setEditingUser(null);
  };

  const compressImage = (file: File, maxSize: number = 300, quality: number = 0.7): Promise<{ blob: Blob; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        // Resize proportionally to fit maxSize
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ blob, dataUrl });
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const origSize = file.size;
    setFormPhotoOriginalSize(origSize);
    try {
      const { blob, dataUrl } = await compressImage(file, 300, 0.7);
      setFormPhoto(dataUrl);
      setFormPhotoFile(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
    } catch {
      setFormPhotoFile(file);
      setFormPhotoOriginalSize(0);
      const reader = new FileReader();
      reader.onload = () => setFormPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormPhoto(null);
    setFormPhotoFile(null);
    setFormPhotoOriginalSize(0);
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users?role=user');
      const data = await res.json();
      setUsers(data.users || []);
    } catch { setUsers([]); }
    finally { setUsersLoading(false); }
  };

  const handleSaveUser = async () => {
    if (!formCin.trim()) { setFormMessage('N°CIN est obligatoire'); setFormMsgType('error'); return; }
    // Validation date examen - doit être supérieure à la date actuelle (fuseau Maroc Africa/Casablanca)
    if (formExamDate) {
      const nowMorocco = new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' });
      const todayMorocco = new Date(nowMorocco);
      todayMorocco.setHours(0, 0, 0, 0);
      const examDate = new Date(formExamDate + 'T00:00:00');
      if (examDate <= todayMorocco) {
        setFormMessage("La date de l'examen doit être supérieure à la date d'aujourd'hui");
        setFormMsgType('error');
        return;
      }
    }
    setSavingUser(true); setFormMessage('');
    try {
      // Upload photo first if a new file was selected
      let photoUrl = editingUser?.photo || null;
      if (formPhotoFile) {
        setFormPhotoUploading(true);
        const formData = new FormData();
        formData.append('file', formPhotoFile);
        formData.append('cin', formCin.trim());
        const uploadRes = await fetch('/api/upload/photo', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        setFormPhotoUploading(false);
        if (uploadRes.ok && uploadData.photo) {
          photoUrl = uploadData.photo;
        } else {
          setFormMessage(uploadData.error || 'Erreur upload photo'); setFormMsgType('error'); setSavingUser(false); return;
        }
      }

      const body: any = {
        cin: formCin.trim().toUpperCase(),
        nomFr: formNomFr || null,
        prenomFr: formPrenomFr || null,
        nomAr: formNomAr || null,
        prenomAr: formPrenomAr || null,
        permisCategory: formCategory,
        examDate: formExamDate || null,
        pinCode: formPin,
        photo: photoUrl,
      };
      if (!editingUser && formPassword) body.password = formPassword;

      const url = editingUser ? `/api/users/${editingUser.cin}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setFormMessage(data.error || 'Erreur'); setFormMsgType('error'); return; }
      setFormMessage(editingUser ? 'Utilisateur modifié ✓' : 'Utilisateur créé ✓'); setFormMsgType('success');
      if (!editingUser) resetUserForm();
      fetchUsers();
    } catch { setFormMessage('Erreur serveur'); setFormMsgType('error'); }
    finally { setSavingUser(false); setFormPhotoUploading(false); }
  };

  const handleEditUser = (u: UserData) => {
    setEditingUser(u);
    setFormCin(u.cin); setFormNomFr(u.nomFr || ''); setFormPrenomFr(u.prenomFr || '');
    setFormNomAr(u.nomAr || ''); setFormPrenomAr(u.prenomAr || '');
    setFormCategory(u.permisCategory); setFormExamDate(u.examDate || '');
    setFormPin(u.pinCode || ''); setFormPassword(''); setFormMessage('');
    setFormPhoto(u.photo); setFormPhotoFile(null);
    setShowUserForm(true);
  };

  const handleDeleteUser = async (cin: string) => {
    if (!confirm(`Supprimer l'utilisateur ${cin} ?`)) return;
    try {
      const res = await fetch(`/api/users/${cin}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
    } catch {}
  };

  const handleToggleActive = async (cin: string) => {
    try {
      await fetch(`/api/users/${cin}/toggle-active`, { method: 'POST' });
      fetchUsers();
    } catch {}
  };

  // Load users when tab switches to users
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'admins') fetchAdmins();
  }, [activeTab]);

  // ===== Gestion des administrateurs =====
  const [admins, setAdmins] = useState<UserData[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<UserData | null>(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminFormCin, setAdminFormCin] = useState('');
  const [adminFormPassword, setAdminFormPassword] = useState('');
  const [adminFormNom, setAdminFormNom] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminMsgType, setAdminMsgType] = useState<'success' | 'error'>('success');

  const resetAdminForm = () => {
    setEditingAdmin(null);
    setAdminFormCin('');
    setAdminFormPassword('');
    setAdminFormNom('');
    setAdminMessage('');
  };

  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const res = await fetch('/api/users?role=admin');
      const data = await res.json();
      setAdmins(data.users || []);
    } catch { setAdmins([]); }
    finally { setAdminsLoading(false); }
  };

  const handleSaveAdmin = async () => {
    if (!adminFormCin.trim()) { setAdminMessage("Nom d'utilisateur est obligatoire"); setAdminMsgType('error'); return; }
    if (!editingAdmin && !adminFormPassword) { setAdminMessage('Mot de passe est obligatoire'); setAdminMsgType('error'); return; }
    setSavingAdmin(true); setAdminMessage('');
    try {
      const body: any = {
        cin: adminFormCin.trim().toUpperCase(),
        nomFr: adminFormNom || null,
        role: 'admin',
        isActive: true,
        permisCategory: 'ALL',
      };
      if (!editingAdmin && adminFormPassword) body.password = adminFormPassword;
      if (editingAdmin && adminFormPassword) body.password = adminFormPassword;

      const url = editingAdmin ? `/api/users/${editingAdmin.cin}` : '/api/users';
      const method = editingAdmin ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setAdminMessage(data.error || 'Erreur'); setAdminMsgType('error'); return; }
      setAdminMessage(editingAdmin ? 'Administrateur modifié ✓' : 'Administrateur créé ✓'); setAdminMsgType('success');
      if (!editingAdmin) resetAdminForm();
      fetchAdmins();
    } catch { setAdminMessage('Erreur serveur'); setAdminMsgType('error'); }
    finally { setSavingAdmin(false); }
  };

  const handleEditAdmin = (a: UserData) => {
    setEditingAdmin(a);
    setAdminFormCin(a.cin);
    setAdminFormPassword('');
    setAdminFormNom(a.nomFr || '');
    setAdminMessage('');
    setShowAdminForm(true);
  };

  const handleDeleteAdmin = async (cin: string) => {
    if (!confirm(`Supprimer l'administrateur ${cin} ?`)) return;
    try {
      const res = await fetch(`/api/users/${cin}`, { method: 'DELETE' });
      if (res.ok) fetchAdmins();
    } catch {}
  };

  // Media upload states
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaResult, setMediaResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pendingImportId, setPendingImportId] = useState<string | null>(null);
  const [compressBeforeImport, setCompressBeforeImport] = useState<{
    done: boolean;
    loading: boolean;
    totalBefore: string;
    totalAfter: string;
    saved: string;
    repaired: number;
    details: { type: string; count: number; repaired: number; before: string; after: string }[];
  } | null>(null);

  // Verification states
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    txtFile: { found: boolean; questions: number };
    images: { count: number; missing: number[]; corrupted: string[] };
    audio: { count: number; missing: number[]; corrupted: string[] };
    video: { count: number; corrupted: string[] };
    responses: { count: number; missing: number[]; corrupted: string[] };
    questionsDetails: { num: number; hasImage: boolean; hasAudio: boolean; hasVideo: boolean; hasResponse: boolean; answers: string; imageValid: boolean; audioValid: boolean; videoValid: boolean; responseValid: boolean }[];
  } | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Series consultation states
  const [selectedSerieView, setSelectedSerieView] = useState<{ category: string; serie: number } | null>(null);
  const [questionsView, setQuestionsView] = useState<QuestionView[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  
  // Modal states for viewing media
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [viewResponseImage, setViewResponseImage] = useState<string | null>(null);
  const [viewAudio, setViewAudio] = useState<string | null>(null);
  const [viewVideo, setViewVideo] = useState<string | null>(null);

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<{ category: string; serie: number } | null>(null);

  // Taille série cache
  const [serieSizeCache, setSerieSizeCache] = useState<Record<string, number>>({});

  // Filtres séries
  const [seriesFilterCategory, setSeriesFilterCategory] = useState<string>('all');
  const [seriesFilterSerie, setSeriesFilterSerie] = useState<string>('all');

  // Filtrer les séries
  const filteredSeriesData = useMemo(() => {
    return seriesData.filter((s) => {
      const matchCat = seriesFilterCategory === 'all' || s.category === seriesFilterCategory;
      const matchSerie = seriesFilterSerie === 'all' || s.serie === parseInt(seriesFilterSerie);
      return matchCat && matchSerie;
    });
  }, [seriesData, seriesFilterCategory, seriesFilterSerie]);

  // Import: séries existantes pour la catégorie sélectionnée
  const importExistingSeries = useMemo(() => {
    return seriesData
      .filter(s => s.category === category)
      .map(s => s.serie)
      .sort((a, b) => a - b);
  }, [seriesData, category]);

  // Numéro de la prochaine série (fill les trous)
  const nextSerieNumber = useMemo(() => {
    if (importExistingSeries.length === 0) return 1;
    // Trouver le premier numéro manquant
    for (let i = 1; i <= Math.max(...importExistingSeries) + 1; i++) {
      if (!importExistingSeries.includes(i)) return i;
    }
    return Math.max(...importExistingSeries) + 1;
  }, [importExistingSeries]);

  // Kan t'change catégorie, auto-select nouvelle série
  useEffect(() => {
    setSerie(nextSerieNumber);
  }, [category, nextSerieNumber]);

  // Charger les données des séries
  useEffect(() => {
    loadSeriesData();
  }, []);

  const loadSeriesData = async () => {
    try {
      const res = await fetch('/api/questions/import');
      if (!res.ok) {
        console.error('Error loading series:', res.status, res.statusText);
        return;
      }
      const data = await res.json();
      if (data.categories) {
        const series: { category: string; serie: number; questions: number }[] = [];
        data.categories.forEach((cat: { code: string; series: { number: number; _count: { questions: number } }[] }) => {
          cat.series.forEach((s) => {
            series.push({ category: cat.code, serie: s.number, questions: s._count.questions });
          });
        });
        setSeriesData(series);
      }
    } catch (error) {
      console.error('Error loading series:', error);
    }
  };

  // Handle media file change
  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMediaFile(e.target.files[0]);
      setMediaResult(null);
      setVerificationResult(null);
      setPendingImportId(null); // reset import id on file change
    }
  };

  // Verify ZIP file first
  const handleVerify = async () => {
    if (!mediaFile) return;

    // Check file extension
    const fileName = mediaFile.name.toLowerCase();
    if (!fileName.endsWith('.zip')) {
      setMediaResult({ success: false, message: '❌ Erreur: Seuls les fichiers ZIP sont acceptés (pas RAR)' });
      return;
    }

    setVerifying(true);
    setVerificationResult(null);

    const formData = new FormData();
    formData.append('file', mediaFile);
    formData.append('category', category);
    formData.append('serie', serie.toString());
    formData.append('verifyOnly', 'true');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min

      const res = await fetch('/api/upload/rar', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Vérifier que la réponse est du JSON (pas HTML)
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        setMediaResult({
          success: false,
          message: `❌ Erreur serveur (HTTP ${res.status}):\n\n• Le serveur n'a pas renvoyé de JSON\n• Vérifiez que le fichier n'est pas trop gros\n• Essayez avec un fichier ZIP plus petit (< 50MB)\n\nDétails: ${text.substring(0, 200)}`
        });
        return;
      }

      const data = await res.json();

      // Always show verification modal if we have verification data (even with errors)
      if (data.verification) {
        // Sauvegarder l'ID du fichier uploadé (pas besoin de re-uploader!)
        if (data.importId) setPendingImportId(data.importId);
        setVerificationResult(data.verification);
        setShowVerificationModal(true);

        // Auto-compression après verification réussie
        if (data.verification.isValid && data.importId) {
          setCompressBeforeImport({ done: false, loading: true, totalBefore: '', totalAfter: '', saved: '', details: [] });
          fetch('/api/upload/rar/compress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ importId: data.importId }),
          }).then(async (cRes) => {
            if (!cRes.ok) {
              const cData = await cRes.json().catch(() => null);
              console.error('Auto-compress error:', cData?.error);
              setCompressBeforeImport(null);
              return;
            }
            const cData = await cRes.json();
            const fmt = (b: number) => {
              if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
              return (b / 1024 / 1024).toFixed(2) + ' MB';
            };
            setCompressBeforeImport({
              done: true,
              loading: false,
              totalBefore: fmt(cData.totalBefore),
              totalAfter: fmt(cData.totalAfter),
              saved: fmt(cData.totalSaved),
              details: [
                { type: '🖼️ Images', count: cData.result.images.compressed, repaired: cData.result.images.repaired || 0, before: fmt(cData.result.images.beforeBytes), after: fmt(cData.result.images.afterBytes) },
                { type: '📋 Réponses', count: cData.result.responses.compressed, repaired: cData.result.responses.repaired || 0, before: fmt(cData.result.responses.beforeBytes), after: fmt(cData.result.responses.afterBytes) },
                { type: '🔊 Audio', count: cData.result.audio.compressed, repaired: cData.result.audio.repaired || 0, before: fmt(cData.result.audio.beforeBytes), after: fmt(cData.result.audio.afterBytes) },
                { type: '🎬 Vidéo', count: cData.result.video.compressed, repaired: cData.result.video.repaired || 0, before: fmt(cData.result.video.beforeBytes), after: fmt(cData.result.video.afterBytes) },
              ],
              repaired: (cData.result.images.repaired || 0) + (cData.result.audio.repaired || 0) + (cData.result.video.repaired || 0) + (cData.result.responses.repaired || 0),
            });
          }).catch(() => setCompressBeforeImport(null));
        }
      } else if (data.success) {
        setMediaResult({ success: false, message: '❌ Aucune donnée de vérification reçue' });
      } else {
        // Show detailed error with all available information
        let errorMsg = '❌ Erreur de vérification:\n\n';
        if (data.error) errorMsg += `• ${data.error}\n`;
        if (data.details) errorMsg += `• ${data.details}\n`;
        if (!data.error && !data.details) errorMsg += '• Erreur inconnue - vérifiez le fichier ZIP\n';
        errorMsg += '\nConseils:\n• Assurez-vous que le fichier est un ZIP valide\n• Vérifiez que le ZIP contient un fichier .txt avec les réponses';
        setMediaResult({ success: false, message: errorMsg });
      }
    } catch (err) {
      const errorMessage = (err as Error).message || 'Erreur inconnue';
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout') || errorMessage.includes('AbortError');
      setMediaResult({
        success: false,
        message: isTimeout
          ? `❌ Timeout - Le serveur a mis trop longtemps à répondre\n\nConseils:\n• Essayez avec un fichier ZIP plus petit (< 50MB)\n• Le fichier ZIP est peut-être trop lourd à traiter\n• Découpez votre ZIP en plusieurs fichiers plus petits`
          : `❌ Erreur de connexion:\n\n• ${errorMessage}\n\nConseils:\n• Vérifiez votre connexion réseau\n• Essayez avec un fichier ZIP plus petit`
      });
    } finally {
      setVerifying(false);
    }
  };

  // Compresser les fichiers avant import
  const handleCompressBeforeImport = async () => {
    if (!pendingImportId) return;
    setCompressBeforeImport({ done: false, loading: true, totalBefore: '', totalAfter: '', saved: '', details: [] });

    try {
      const res = await fetch('/api/upload/rar/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: pendingImportId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Erreur lors de la compression');
        setCompressBeforeImport(null);
        return;
      }

      const data = await res.json();
      const fmt = (b: number) => {
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1024 / 1024).toFixed(2) + ' MB';
      };

      setCompressBeforeImport({
        done: true,
        loading: false,
        totalBefore: fmt(data.totalBefore),
        totalAfter: fmt(data.totalAfter),
        saved: fmt(data.totalSaved),
        details: [
          { type: '🖼️ Images', count: data.result.images.compressed, before: fmt(data.result.images.beforeBytes), after: fmt(data.result.images.afterBytes) },
          { type: '📋 Réponses', count: data.result.responses.compressed, before: fmt(data.result.responses.beforeBytes), after: fmt(data.result.responses.afterBytes) },
          { type: '🔊 Audio', count: data.result.audio.compressed, before: fmt(data.result.audio.beforeBytes), after: fmt(data.result.audio.afterBytes) },
          { type: '🎬 Vidéo', count: data.result.video.compressed, before: fmt(data.result.video.beforeBytes), after: fmt(data.result.video.afterBytes) },
        ],
      });
    } catch {
      alert('Erreur de connexion');
      setCompressBeforeImport(null);
    }
  };

  // Confirm import after verification (pas de re-upload! utilise importId)
  const handleConfirmImport = async () => {
    setShowVerificationModal(false);
    setCompressBeforeImport(null);

    if (!pendingImportId) {
      setMediaResult({ success: false, message: '❌ Erreur: fichier expiré, veuillez ré-uploader' });
      return;
    }

    setUploadingMedia(true);
    setMediaResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      // Utilise importId → le serveur utilise le fichier déjà uploadé, PAS de re-upload!
      const res = await fetch('/api/upload/rar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importId: pendingImportId,
          category,
          serie: serie.toString(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        setMediaResult({ success: false, message: `❌ Erreur serveur (HTTP ${res.status})\n\n${text.substring(0, 200)}` });
        return;
      }

      const data = await res.json();

      if (data.success) {
        const ext = data.extracted;
        const details = ext ? [
          `📷 Images: ${ext.images}`,
          `🎵 Audio MP3: ${ext.audio}`,
          `🎬 Vidéo MP4: ${ext.video}`,
          `🖼️ Réponses: ${ext.responses}`,
          `📄 Fichier TXT: ${ext.txtProcessed ? '✅ Traité' : '❌ Non trouvé'}`,
          `📝 Questions importées: ${data.questionsImported || 0}`
        ].join('\n') : '';

        setMediaResult({
          success: true,
          message: `✅ ${data.message}\n\n${details}`
        });
        setPendingImportId(null);
        loadSeriesData();
        setActiveTab('series');
      } else {
        setMediaResult({ success: false, message: `❌ Erreur: ${data.error}` });
      }
    } catch (err) {
      const errorMessage = (err as Error)?.message || 'Erreur inconnue';
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
      setMediaResult({
        success: false,
        message: isTimeout
          ? '❌ Timeout - le traitement a pris trop longtemps'
          : `❌ Erreur: ${errorMessage}`
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  // Cancel verification
  const handleCancelVerification = () => {
    setShowVerificationModal(false);
    setVerificationResult(null);
    setPendingImportId(null);
    setCompressBeforeImport(null);
  };

  // Handle media file upload (RAR/ZIP)
  const handleMediaUpload = async (skipVerify = false) => {
    if (!mediaFile) return;

    setUploadingMedia(true);
    setMediaResult(null);

    const formData = new FormData();
    formData.append('file', mediaFile);
    formData.append('category', category);
    formData.append('serie', serie.toString());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min

      const res = await fetch('/api/upload/rar', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Vérifier que la réponse est du JSON
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        setMediaResult({
          success: false,
          message: `❌ Erreur serveur (HTTP ${res.status}):\n\n• Le fichier est peut-être trop gros\n• Essayez avec un ZIP plus petit (< 50MB)\n\nDétails: ${text.substring(0, 200)}`
        });
        return;
      }

      const data = await res.json();

      if (data.success) {
        const ext = data.extracted;
        const details = ext ? [
          `📷 Images: ${ext.images}`,
          `🎵 Audio MP3: ${ext.audio}`,
          `🎬 Vidéo MP4: ${ext.video}`,
          `🖼️ Réponses: ${ext.responses}`,
          `📄 Fichier TXT: ${ext.txtProcessed ? '✅ Traité' : '❌ Non trouvé'}`,
          `📝 Questions importées: ${data.questionsImported || 0}`
        ].join('\n') : '';
        
        setMediaResult({ 
          success: true, 
          message: `✅ ${data.message}\n📁 Fichier: ${data.fileName} (${data.fileSize})\n\n${details}` 
        });
        loadSeriesData(); // Refresh series list
      } else {
        setMediaResult({ success: false, message: `❌ Erreur: ${data.error}` });
      }
    } catch (err) {
      const errorMessage = (err as Error)?.message || 'Erreur inconnue';
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout') || errorMessage.includes('AbortError');
      setMediaResult({
        success: false,
        message: isTimeout
          ? `❌ Timeout - Le serveur a mis trop longtemps à répondre\n\nConseils:\n• Essayez avec un fichier ZIP plus petit (< 50MB)\n• Découpez votre ZIP en plusieurs fichiers plus petits`
          : `❌ Erreur de connexion:\n\n• ${errorMessage}\n\n• Le fichier est peut-être trop gros`
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  // Load questions for a specific serie
  const loadSerieQuestions = async (cat: string, ser: number) => {
    setLoadingQuestions(true);
    setSelectedSerieView({ category: cat, serie: ser });
    
    try {
      const res = await fetch(`/api/questions?category=${cat}&serie=${ser}`);
      if (!res.ok) {
        console.error('Error loading questions:', res.status, res.statusText);
        setQuestionsView([]);
        return;
      }
      const data = await res.json();
      if (data.questions) {
        setQuestionsView(data.questions.map((q: QuestionView) => ({
          id: q.id,
          order: q.order,
          image: q.image,
          audio: q.audio,
          video: q.video,
          responses: q.responses,
        })));
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      setQuestionsView([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Analyser taille d'une série
  const loadSerieSize = async (cat: string, ser: number) => {
    try {
      const res = await fetch(`/api/admin/compress?category=${cat}&serie=${ser}`);
      if (res.ok) {
        const data = await res.json();
        setSerieSizeCache(prev => ({ ...prev, [`${cat}_${ser}`]: data.totalSize }));
      }
    } catch {}
  };

  // Télécharger une série (ZIP)
  const handleDownloadSerie = async (cat: string, ser: number) => {
    try {
      const res = await fetch(`/api/admin/download?category=${cat}&serie=${ser}`, { method: 'POST' });
      if (!res.ok) {
        alert('Erreur lors du téléchargement');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cat}_Serie${ser}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur de connexion');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  // Réparer une série existante
  const [repairingSerie, setRepairingSerie] = useState<string | null>(null);
  const handleRepairSerie = async (cat: string, ser: number) => {
    const key = `${cat}_${ser}`;
    setRepairingSerie(key);
    try {
      const res = await fetch('/api/series/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, serie: ser }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('❌ ' + (data.error || 'Erreur lors de la réparation'));
        return;
      }
      const { summary, report } = data;
      let msg = `✅ Réparation série ${cat}/${ser} terminée!\n\n`;
      msg += `📁 ${summary.totalRepaired} fichier(s) réparé(s)\n`;
      if (summary.totalRemoved > 0) {
        msg += `🗑️ ${summary.totalRemoved} fichier(s) irréparable(s) supprimé(s)\n`;
      }
      if (report.repaired.length > 0) {
        msg += '\n✅ Réparés:\n' + report.repaired.map((r: string) => '  • ' + r).join('\n');
      }
      if (report.removed.length > 0) {
        msg += '\n❌ Supprimés (irréparables):\n' + report.removed.map((r: string) => '  • ' + r).join('\n');
      }
      if (summary.totalRepaired === 0 && summary.totalRemoved === 0) {
        msg += '✨ Tous les fichiers sont déjà valides!';
      }
      alert(msg);
      loadSeriesData();
    } catch {
      alert('❌ Erreur de connexion');
    } finally {
      setRepairingSerie(null);
    }
  };

  // Open delete confirmation dialog
  const handleDeleteClick = (cat: string, ser: number) => {
    setDeleteTarget({ category: cat, serie: ser });
  };

  // Confirm and execute deletion
  const confirmDeleteSerie = async () => {
    if (!deleteTarget) return;
    const { category: cat, serie: ser } = deleteTarget;
    setDeleteTarget(null);

    try {
      const res = await fetch(`/api/questions/delete?category=${cat}&serie=${ser}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadSeriesData();
        if (selectedSerieView?.category === cat && selectedSerieView?.serie === ser) {
          setSelectedSerieView(null);
          setQuestionsView([]);
        }
      }
    } catch (error) {
      console.error('Error deleting serie:', error);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-800 via-gray-900 to-black p-4">
      <FullscreenButton />
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-gray-700 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
          <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 px-4 py-1 rounded font-bold flex items-center gap-2">
            ← Déconnexion
          </button>
          <h2 className="text-xl font-bold">👑 Panel Administrateur</h2>
        </div>

        {/* Tabs */}
        <div className="bg-gray-700 flex border-b border-gray-600">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-6 py-3 font-bold transition-colors ${activeTab === 'import' ? 'bg-gray-600 text-yellow-400' : 'text-gray-300 hover:text-white'}`}
          >
            📥 Importer
          </button>
          <button
            onClick={() => setActiveTab('series')}
            className={`px-6 py-3 font-bold transition-colors ${activeTab === 'series' ? 'bg-gray-600 text-yellow-400' : 'text-gray-300 hover:text-white'}`}
          >
            📂 Séries
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-bold transition-colors ${activeTab === 'users' ? 'bg-gray-600 text-yellow-400' : 'text-gray-300 hover:text-white'}`}
          >
            👥 Utilisateurs
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-6 py-3 font-bold transition-colors ${activeTab === 'admins' ? 'bg-gray-600 text-yellow-400' : 'text-gray-300 hover:text-white'}`}
          >
            🔑 Administrateurs
          </button>
        </div>

        {/* Content */}
        <div className="bg-gray-800 rounded-b-lg p-6 shadow-xl min-h-96">
          {/* Tab: Import */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white mb-4">📥 Importer une série complète</h3>
              
              {/* Format info */}
              <div className="bg-gray-700 rounded-lg p-4 text-sm text-gray-300">
                <p className="font-bold text-yellow-400 mb-2">📦 Structure du fichier ZIP:</p>
                <p className="mb-2">Le fichier ZIP doit contenir:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li><code className="bg-gray-800 px-1 rounded">reponses.txt</code> - Fichier texte avec les réponses</li>
                  <li><code className="bg-gray-800 px-1 rounded">images/</code> - Images des questions (q1.jpg, q2.png...)</li>
                  <li><code className="bg-gray-800 px-1 rounded">audio/</code> - Fichiers audio MP3 (q1.mp3, q2.mp3...)</li>
                  <li><code className="bg-gray-800 px-1 rounded">responses/</code> - Images de réponse (r1.jpg, r2.png...)</li>
                  <li><code className="bg-gray-800 px-1 rounded">video/</code> - Vidéos MP4 (optionnel)</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <p className="font-bold text-green-400 mb-1">📋 Format du fichier reponses.txt:</p>
                  <p className="text-gray-400">• Colonne 1: Numéro de question</p>
                  <p className="text-gray-400">• Colonne 2: Réponse(s) correcte(s)</p>
                  <p className="text-gray-400">• Séparateur: tabulation ou espace</p>
                  <pre className="bg-gray-800 p-2 rounded mt-2 text-xs text-green-300">
{`1\t3      ← Question 1: réponse 3
2\t3      ← Question 2: réponse 3
3\t1      ← Question 3: réponse 1
4\t2      ← Question 4: réponse 2
5\t13     ← Question 5: réponses 1 et 3
6\t1      ← Question 6: réponse 1
...`}
                  </pre>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <p className="font-bold text-blue-400 mb-1">📁 Formats acceptés:</p>
                  <p className="text-gray-400">• Images: jpg, jpeg, png, gif, webp, bmp</p>
                  <p className="text-gray-400">• Audio: mp3 uniquement</p>
                  <p className="text-gray-400">• Vidéo: mp4 uniquement</p>
                </div>
              </div>

              {/* Category & Serie selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Catégorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2"
                  >
                    <option value="A">A - Moto</option>
                    <option value="B">B - Voiture</option>
                    <option value="C">C - Camion</option>
                    <option value="D">D - Bus</option>
                    <option value="E">E - Remorque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Numéro de série</label>
                  <select
                    value={serie}
                    onChange={(e) => setSerie(parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2"
                  >
                    {importExistingSeries.map((n) => (
                      <option key={n} value={n}>Série {n}</option>
                    ))}
                    <option key="new" value={nextSerieNumber} className="text-green-400 font-bold">
                      ✨ Nouvelle série {nextSerieNumber}
                    </option>
                  </select>
                  {importExistingSeries.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">Séries existantes: {importExistingSeries.join(', ')}</p>
                  )}
                </div>
              </div>

              {/* File upload */}
              <div>
                <label className="block text-gray-300 mb-2">📦 Fichier ZIP (contient tout)</label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleMediaFileChange}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:bg-green-500 file:text-black file:font-bold hover:file:bg-green-400"
                />
                {mediaFile && (
                  <p className="mt-2 text-green-400">📦 {mediaFile.name} ({(mediaFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                )}
              </div>

              {/* Verify button */}
              <button
                onClick={handleVerify}
                disabled={!mediaFile || verifying}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold py-3 rounded-lg hover:from-blue-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {verifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Vérification en cours...
                  </span>
                ) : (
                  '🔍 Vérifier le fichier ZIP'
                )}
              </button>

              {/* Result */}
              {mediaResult && (
                <div className={`p-4 rounded-lg whitespace-pre-line ${mediaResult.success ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {mediaResult.message}
                </div>
              )}

              {/* Verification Modal */}
              {showVerificationModal && verificationResult && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                  <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className={`px-4 py-3 flex justify-between items-center ${verificationResult.isValid ? 'bg-green-600' : 'bg-red-600'}`}>
                      <h3 className="text-white font-bold text-lg">
                        {verificationResult.isValid ? '✅ Vérification réussie' : '❌ Erreurs détectées'}
                      </h3>
                      <button onClick={handleCancelVerification} className="text-white hover:text-gray-200 text-2xl">&times;</button>
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto flex-1">
                      {/* Errors */}
                      {verificationResult.errors.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-red-400 font-bold mb-2">❌ Erreurs:</h4>
                          <ul className="text-red-300 text-sm space-y-1">
                            {verificationResult.errors.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                          {verificationResult.errors.some(e => e.toLowerCase().includes('corrompu')) && (
                            <button
                              onClick={async () => {
                                if (!pendingImportId) return;
                                const btn = (event?.target as HTMLButtonElement);
                                const origText = btn?.textContent || '';
                                if (btn) btn.textContent = '⏳ Réparation en cours...';
                                try {
                                  // 1) Réparer les fichiers corrompus
                                  const res = await fetch('/api/upload/rar/repair', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ importId: pendingImportId }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) {
                                    alert('❌ ' + (data.error || 'Erreur lors de la réparation'));
                                    if (btn) btn.textContent = origText;
                                    return;
                                  }

                                  // 2) Re-vérifier après réparation
                                  if (btn) btn.textContent = '⏳ Vérification...';
                                  const verifyRes = await fetch('/api/upload/rar/verify', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ importId: pendingImportId }),
                                  });
                                  let newVerification = verificationResult;
                                  if (verifyRes.ok) {
                                    const verifyData = await verifyRes.json();
                                    if (verifyData.verification) {
                                      setVerificationResult(verifyData.verification);
                                      newVerification = verifyData.verification;
                                    }
                                  }

                                  // 3) Afficher le résultat de la réparation
                                  const { summary, report } = data;
                                  let msg = '✅ Réparation terminée!\n';
                                  msg += `📁 ${summary.totalRepaired} fichier(s) réparé(s)\n`;
                                  if (summary.totalRemoved > 0) {
                                    msg += `🗑️ ${summary.totalRemoved} fichier(s) irréparable(s) supprimé(s)\n`;
                                  }
                                  if (report.repaired.length > 0) {
                                    msg += '\n✅ Réparés:\n' + report.repaired.map((r: string) => '  • ' + r).join('\n');
                                  }
                                  if (report.removed.length > 0) {
                                    msg += '\n❌ Supprimés (irréparables):\n' + report.removed.map((r: string) => '  • ' + r).join('\n');
                                  }

                                  // 4) Vérifier s'il reste des erreurs (autres que fichiers manquants)
                                  const remainingErrors = newVerification.errors.filter(e => !e.toLowerCase().includes('corrompu'));
                                  const hasOnlyMissing = remainingErrors.length === 0 && 
                                    (newVerification.images.missing.length > 0 || newVerification.audio.missing.length > 0 || newVerification.responses.missing.length > 0);

                                  if (newVerification.isValid || hasOnlyMissing) {
                                    // 5) Lancer la compression automatiquement
                                    msg += '\n🔄 Compression en cours...';
                                    alert(msg);
                                    if (btn) btn.textContent = '⏳ Compression...';
                                    setCompressBeforeImport({ done: false, loading: true, totalBefore: '', totalAfter: '', saved: '', repaired: summary.totalRepaired, details: [] });

                                    const cRes = await fetch('/api/upload/rar/compress', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ importId: pendingImportId }),
                                    });
                                    if (cRes.ok) {
                                      const cData = await cRes.json();
                                      const fmt = (b: number) => {
                                        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
                                        return (b / 1024 / 1024).toFixed(2) + ' MB';
                                      };
                                      setCompressBeforeImport({
                                        done: true,
                                        loading: false,
                                        totalBefore: fmt(cData.totalBefore),
                                        totalAfter: fmt(cData.totalAfter),
                                        saved: fmt(cData.totalSaved),
                                        repaired: summary.totalRepaired,
                                        details: [
                                          { type: '🖼️ Images', count: cData.result.images.compressed, repaired: cData.result.images.repaired || 0, before: fmt(cData.result.images.beforeBytes), after: fmt(cData.result.images.afterBytes) },
                                          { type: '📋 Réponses', count: cData.result.responses.compressed, repaired: cData.result.responses.repaired || 0, before: fmt(cData.result.responses.beforeBytes), after: fmt(cData.result.responses.afterBytes) },
                                          { type: '🔊 Audio', count: cData.result.audio.compressed, repaired: cData.result.audio.repaired || 0, before: fmt(cData.result.audio.beforeBytes), after: fmt(cData.result.audio.afterBytes) },
                                          { type: '🎬 Vidéo', count: cData.result.video.compressed, repaired: cData.result.video.repaired || 0, before: fmt(cData.result.video.beforeBytes), after: fmt(cData.result.video.afterBytes) },
                                        ],
                                      });
                                    } else {
                                      const cErr = await cRes.json().catch(() => null);
                                      alert('❌ Erreur compression: ' + (cErr?.error || 'inconnue'));
                                      setCompressBeforeImport(null);
                                    }
                                  } else {
                                    // Il reste des erreurs non-résolues
                                    msg += '\n\n⚠️ Des erreurs subsistent. Vérifiez le tableau ci-dessus.';
                                    alert(msg);
                                  }
                                } catch {
                                  alert('❌ Erreur de connexion');
                                } finally {
                                  if (btn) btn.textContent = origText;
                                }
                              }}
                              className="mt-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-3 py-1 rounded font-bold transition-colors"
                            >
                              🔧 Réparer les fichiers corrompus (ffmpeg)
                            </button>
                          )}
                        </div>
                      )}

                      {/* Warnings */}
                      {verificationResult.warnings.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-yellow-400 font-bold mb-2">⚠️ Avertissements:</h4>
                          <ul className="text-yellow-300 text-sm space-y-1">
                            {verificationResult.warnings.map((warn, i) => (
                              <li key={i}>• {warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-gray-700 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-white">{verificationResult.txtFile.questions}</div>
                          <div className="text-gray-400 text-sm">Questions TXT</div>
                        </div>
                        <div className="bg-gray-700 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-blue-400">{verificationResult.images.count}</div>
                          <div className="text-gray-400 text-sm">Images</div>
                        </div>
                        <div className="bg-gray-700 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-purple-400">{verificationResult.audio.count}</div>
                          <div className="text-gray-400 text-sm">Audio MP3</div>
                        </div>
                      </div>

                      {/* Questions details table */}
                      <div className="mb-4">
                        <h4 className="text-gray-300 font-bold mb-2">📋 Détail des questions:</h4>
                        <div className="overflow-x-auto max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-700 sticky top-0">
                              <tr>
                                <th className="px-2 py-1 text-left text-gray-300">#</th>
                                <th className="px-2 py-1 text-center text-gray-300">Image</th>
                                <th className="px-2 py-1 text-center text-gray-300">Audio</th>
                                <th className="px-2 py-1 text-center text-gray-300">Vidéo</th>
                                <th className="px-2 py-1 text-center text-gray-300">Rép.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {verificationResult.questionsDetails.map((q) => (
                                <tr key={q.num} className="border-b border-gray-700">
                                  <td className="px-2 py-1 text-white font-bold">{q.num}</td>
                                  <td className="px-2 py-1 text-center">
                                    {q.hasImage ? (
                                      q.imageValid ? 
                                        <span className="text-green-400" title="Image valide">✅</span> : 
                                        <span className="text-red-400" title="Image corrompue!">⚠️</span>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    {q.hasAudio ? (
                                      q.audioValid ? 
                                        <span className="text-green-400" title="Audio valide">✅</span> : 
                                        <span className="text-red-400" title="Audio corrompu!">⚠️</span>
                                    ) : (
                                      <span className="text-red-400" title="Audio manquant">❌</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    {q.hasVideo ? (
                                      q.videoValid ? 
                                        <span className="text-green-400" title="Vidéo valide">✅</span> : 
                                        <span className="text-red-400" title="Vidéo corrompue!">⚠️</span>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-center text-yellow-400 font-bold">{q.answers}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="text-green-400">✅</span> Valide | 
                          <span className="text-red-400 ml-2">⚠️</span> Corrompu | 
                          <span className="text-red-400 ml-2">❌</span> Manquant | 
                          <span className="text-gray-500 ml-2">-</span> Optionnel
                        </div>
                      </div>
                    </div>

                    {/* Compression avant import */}
                    {verificationResult.isValid && (
                      <div className="px-4 pb-3">
                        {compressBeforeImport?.loading ? (
                          <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-4 text-center">
                            <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-orange-400 font-bold">🗜️ Compression en cours...</p>
                            <p className="text-orange-300/70 text-xs mt-1">Réduction de la taille des fichiers</p>
                          </div>
                        ) : compressBeforeImport?.done ? (
                          <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
                            <h4 className="text-green-400 font-bold mb-2">✅ Compression terminée !</h4>
                            {compressBeforeImport.repaired > 0 && (
                              <p className="text-yellow-400 text-xs mb-2">🔧 {compressBeforeImport.repaired} fichier(s) corrompu(s) réparé(s)</p>
                            )}
                            <div className="grid grid-cols-3 gap-2 text-center mb-3">
                              <div className="bg-gray-700 rounded p-2">
                                <p className="text-gray-400 text-xs">Avant</p>
                                <p className="text-white font-bold">{compressBeforeImport.totalBefore}</p>
                              </div>
                              <div className="bg-green-800/50 rounded p-2 border border-green-500/50">
                                <p className="text-green-400 text-xs">Économisé</p>
                                <p className="text-green-400 font-bold">-{compressBeforeImport.saved}</p>
                              </div>
                              <div className="bg-gray-700 rounded p-2">
                                <p className="text-gray-400 text-xs">Après</p>
                                <p className="text-white font-bold">{compressBeforeImport.totalAfter}</p>
                              </div>
                            </div>
                            {compressBeforeImport.details.filter(d => d.count > 0).map((d, i) => (
                              <div key={i} className="flex justify-between text-xs bg-gray-700/50 rounded px-2 py-1 mb-1">
                                <span className="text-gray-300">{d.type} ({d.count})</span>
                                <span>
                                  <span className="text-red-400">{d.before}</span>
                                  <span className="text-gray-500 mx-1">→</span>
                                  <span className="text-green-400">{d.after}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="px-4 py-3 bg-gray-700 flex gap-3 justify-end">
                      <button
                        onClick={handleCancelVerification}
                        className="px-5 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-bold"
                      >
                        ❌ Annuler
                      </button>
                      {verificationResult.isValid && (
                        <button
                          onClick={handleConfirmImport}
                          disabled={uploadingMedia || (compressBeforeImport?.loading ?? false) || !compressBeforeImport?.done}
                          className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold disabled:opacity-50 transition-colors"
                          title={!compressBeforeImport?.done ? 'Veuillez attendre la fin de la compression' : undefined}
                        >
                          {uploadingMedia ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Import...
                            </span>
                          ) : !compressBeforeImport?.done ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Compression...
                            </span>
                          ) : (
                            `✅ Confirmer l'import (compressé)`
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Series */}
          {activeTab === 'series' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">📂 Séries importées</h3>
                {selectedSerieView && (
                  <button 
                    onClick={() => { setSelectedSerieView(null); setQuestionsView([]); }}
                    className="bg-gray-600 hover:bg-gray-500 px-4 py-1 rounded text-white"
                  >
                    ← Retour aux séries
                  </button>
                )}
              </div>
              
              {/* Liste des séries */}
              {!selectedSerieView && (
                <>
                  {/* Filtres */}
                  <div className="flex flex-wrap gap-4 mb-4 p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-gray-400 text-xs mb-1 font-bold">Catégorie</label>
                      <select
                        value={seriesFilterCategory}
                        onChange={(e) => setSeriesFilterCategory(e.target.value)}
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="all">Toutes</option>
                        <option value="A">A - Moto</option>
                        <option value="B">B - Voiture</option>
                        <option value="C">C - Camion</option>
                        <option value="D">D - Bus</option>
                        <option value="E">E - Remorque</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-gray-400 text-xs mb-1 font-bold">Série</label>
                      <select
                        value={seriesFilterSerie}
                        onChange={(e) => setSeriesFilterSerie(e.target.value)}
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="all">Toutes</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <option key={n} value={String(n)}>Série {n}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => { setSeriesFilterCategory('all'); setSeriesFilterSerie('all'); }}
                        className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-white text-sm"
                      >
                        🔄 Réinitialiser
                      </button>
                    </div>
                  </div>

                  {/* Nombre de résultats */}
                  {filteredSeriesData.length > 0 && (
                    <p className="text-gray-400 text-sm mb-2">
                      {filteredSeriesData.length} série{filteredSeriesData.length > 1 ? 's' : ''} trouvée{filteredSeriesData.length > 1 ? 's' : ''}
                    </p>
                  )}

                  {filteredSeriesData.length === 0 ? (
                    <div className="text-gray-400 text-center py-8">
                      <p className="text-4xl mb-4">📭</p>
                      <p>{seriesData.length === 0 ? 'Aucune série importée' : 'Aucun résultat pour ces filtres'}</p>
                      <p className="text-sm">Utilisez l&apos;onglet Importer pour ajouter des questions</p>
                    </div>
                  ) : (
                      <div className="grid gap-2">
                      <div className="grid grid-cols-5 bg-gray-700 text-gray-300 font-bold px-4 py-2 rounded-lg">
                        <span>Catégorie</span>
                        <span>Série</span>
                        <span>Questions</span>
                        <span>Taille</span>
                        <span>Actions</span>
                      </div>
                      {filteredSeriesData.map((s, i) => {
                        const sizeInfo = serieSizeCache[`${s.category}_${s.serie}`];
                        return (
                          <div key={i} className="grid grid-cols-5 bg-gray-700/50 text-white px-4 py-3 rounded-lg hover:bg-gray-700 items-center">
                            <span className="font-bold text-yellow-400">{s.category}</span>
                            <span>Série {s.serie}</span>
                            <span className="text-green-400">{s.questions} questions</span>
                            <span className="text-gray-400 text-sm">
                              {sizeInfo !== undefined
                                ? `${(sizeInfo / 1024 / 1024).toFixed(1)} MB`
                                : <button onClick={() => loadSerieSize(s.category, s.serie)} className="text-cyan-400 hover:text-cyan-300 text-xs underline">Analyzer</button>
                              }
                            </span>
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={() => loadSerieQuestions(s.category, s.serie)}
                                className="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs"
                                title="Voir les questions"
                              >
                                👁️
                              </button>
                              <button
                                onClick={() => handleDownloadSerie(s.category, s.serie)}
                                className="bg-cyan-600 hover:bg-cyan-500 px-2 py-1 rounded text-xs"
                                title="Télécharger la série (ZIP)"
                              >
                                📥
                              </button>
                              <button
                                onClick={() => handleRepairSerie(s.category, s.serie)}
                                className="bg-yellow-600 hover:bg-yellow-500 px-2 py-1 rounded text-xs disabled:opacity-50"
                                title="Réparer les fichiers corrompus"
                                disabled={repairingSerie === `${s.category}_${s.serie}`}
                              >
                                {repairingSerie === `${s.category}_${s.serie}` ? '⏳' : '🔧'}
                              </button>
                              <button
                                onClick={() => handleDeleteClick(s.category, s.serie)}
                                className="bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-xs"
                                title="Supprimer la série"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </>
              )}

              {/* Vue des questions d'une série */}
              {selectedSerieView && (
                <div>
                  {loadingQuestions ? (
                    <div className="text-gray-400 text-center py-8">
                      <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p>Chargement des questions...</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-gray-700 rounded-lg p-3 mb-4 text-white flex items-center justify-between">
                        <div>
                          <span className="font-bold text-yellow-400">{selectedSerieView.category}</span>
                          <span className="mx-2">•</span>
                          <span>Série {selectedSerieView.serie}</span>
                          <span className="mx-2">•</span>
                          <span className="text-green-400">{questionsView.length} questions</span>
                        </div>
                      </div>

                      {/* Tableau des questions */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-white text-sm">
                          <thead>
                            <tr className="bg-gray-700 text-gray-300">
                              <th className="px-3 py-2 text-left">#</th>
                              <th className="px-3 py-2 text-left">Image</th>
                              <th className="px-3 py-2 text-left">Audio</th>
                              <th className="px-3 py-2 text-left">Vidéo</th>
                              <th className="px-3 py-2 text-center">Réponses</th>
                            </tr>
                          </thead>
                          <tbody>
                            {questionsView.map((q, idx) => (
                              <tr key={q.id} className={idx % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-700/50'}>
                                <td className="px-3 py-2 font-bold text-yellow-400">{q.order}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {q.image ? (
                                      <>
                                        <span className="text-green-400 text-xs">✅</span>
                                        <button 
                                          onClick={() => setViewImage(q.image)}
                                          className="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs font-bold transition-colors"
                                        >
                                          👁️ Voir
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-red-400 text-xs">❌ Absent</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {q.audio ? (
                                      <>
                                        <span className="text-green-400 text-xs">✅</span>
                                        <button 
                                          onClick={() => setViewAudio(q.audio)}
                                          className="bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded text-xs font-bold transition-colors"
                                        >
                                          🔊 Écouter
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-red-400 text-xs">❌ Absent</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {q.video ? (
                                      <>
                                        <span className="text-green-400 text-xs">✅</span>
                                        <button 
                                          onClick={() => setViewVideo(q.video)}
                                          className="bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-xs font-bold transition-colors"
                                        >
                                          🎬 Voir
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-gray-500 text-xs">-</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex justify-center gap-1">
                                    {[1, 2, 3, 4].map((num) => {
                                      const resp = q.responses.find(r => r.order === num);
                                      return (
                                        <span 
                                          key={num}
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                            resp?.isCorrect 
                                              ? 'bg-green-500 text-white' 
                                              : 'bg-gray-600 text-gray-300'
                                          }`}
                                        >
                                          {num}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Modal pour voir l'image de la question */}
                      {viewImage && (
                        <div 
                          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-auto"
                          onClick={() => setViewImage(null)}
                        >
                          <div className="relative bg-gray-900 rounded-lg overflow-hidden max-w-[95vw] max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                              <span className="text-gray-300 text-sm font-bold">📷 Image de la question</span>
                              <button 
                                onClick={() => setViewImage(null)}
                                className="bg-red-600 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="p-2 overflow-auto flex-1 flex items-center justify-center">
                              <img 
                                src={viewImage} 
                                alt="Image question" 
                                className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Modal pour voir l'image de réponse */}
                      {viewResponseImage && (
                        <div 
                          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-auto"
                          onClick={() => setViewResponseImage(null)}
                        >
                          <div className="relative bg-gray-900 rounded-lg overflow-hidden max-w-[95vw] max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                              <span className="text-gray-300 text-sm font-bold">🖼️ Image de réponse</span>
                              <button 
                                onClick={() => setViewResponseImage(null)}
                                className="bg-red-600 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="p-2 overflow-auto flex-1 flex items-center justify-center">
                              <img 
                                src={viewResponseImage} 
                                alt="Image réponse" 
                                className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Modal pour écouter l'audio */}
                      {viewAudio && (
                        <div 
                          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                          onClick={() => setViewAudio(null)}
                        >
                          <div className="relative max-w-md w-full bg-gray-900 rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => setViewAudio(null)}
                              className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold z-10"
                            >
                              ✕
                            </button>
                            <div className="p-4 text-center">
                              <div className="text-4xl mb-4">🎵</div>
                              <div className="text-white font-bold mb-2">Audio de la question</div>
                              <div className="text-gray-400 text-xs mb-4 break-all">{viewAudio.split('/').pop()}</div>
                              <audio 
                                controls 
                                autoPlay 
                                className="w-full"
                                src={viewAudio}
                              >
                                Votre navigateur ne supporte pas l&apos;audio.
                              </audio>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Modal pour voir la vidéo */}
                      {viewVideo && (
                        <div 
                          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
                          onClick={() => setViewVideo(null)}
                        >
                          <div className="relative max-w-4xl w-full bg-gray-900 rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => setViewVideo(null)}
                              className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold z-10"
                            >
                              ✕
                            </button>
                            <div className="p-2 text-gray-400 text-sm text-center border-b border-gray-700">
                              Vidéo de la question
                            </div>
                            <div className="p-4">
                              <div className="text-gray-400 text-xs mb-2 break-all text-center">{viewVideo.split('/').pop()}</div>
                              <video 
                                controls 
                                autoPlay 
                                className="w-full max-h-[70vh] bg-black rounded"
                                src={viewVideo}
                              >
                                Votre navigateur ne supporte pas la vidéo.
                              </video>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: Users */}
          {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">👥 Gestion des utilisateurs</h3>
                <button onClick={() => { resetUserForm(); setShowUserForm(true); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm">➕ Nouvel utilisateur</button>
              </div>

              {/* Formulaire utilisateur */}
              {showUserForm && (
                <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-600">
                  {/* Photo upload */}
                  <div className="flex items-center gap-4 mb-4 p-3 bg-gray-700/50 rounded-lg">
                    <div className="relative">
                      {formPhoto ? (
                        <img src={formPhoto} alt="Photo" className="w-16 h-16 rounded-full object-cover border-2 border-gray-500" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-2xl border-2 border-gray-500">👤</div>
                      )}
                      {formPhotoUploading && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-gray-300 text-xs mb-1 font-bold">📷 Photo de l'utilisateur</label>
                      <div className="flex gap-2">
                        <label className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors">
                          {formPhotoFile ? '📷 Changer' : '📷 Choisir'}
                          <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                        </label>
                        {formPhoto && (
                          <button onClick={handleRemovePhoto} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">🗑️ Supprimer</button>
                        )}
                      </div>
                      {formPhotoFile && (
                        <p className="text-gray-400 text-xs mt-1 truncate max-w-[200px]">{formPhotoFile.name}</p>
                      )}
                      {formPhotoFile && formPhotoOriginalSize > 0 && (
                        <p className="text-green-400 text-xs mt-0.5">
                          🗜️ {(formPhotoOriginalSize / 1024).toFixed(0)} KB → {(formPhotoFile.size / 1024).toFixed(0)} KB
                          {formPhotoOriginalSize > formPhotoFile.size && (
                            <span className="text-green-300"> (−{Math.round((1 - formPhotoFile.size / formPhotoOriginalSize) * 100)}%)</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">N°CIN *</label>
                      <input type="text" value={formCin.toUpperCase()} onChange={e => setFormCin(e.target.value.toUpperCase())} disabled={!!editingUser} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm disabled:opacity-50 uppercase" placeholder="CIN obligatoire" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">Nom (FR)</label>
                      <input type="text" value={formNomFr} onChange={e => setFormNomFr(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" placeholder="Nom en français" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">Prénom (FR)</label>
                      <input type="text" value={formPrenomFr} onChange={e => setFormPrenomFr(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" placeholder="Prénom en français" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">النسب (عربي)</label>
                      <input type="text" value={formNomAr} onChange={e => setFormNomAr(e.target.value)} dir="rtl" className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" placeholder="النسب بالعربية" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">الإسم (عربي)</label>
                      <input type="text" value={formPrenomAr} onChange={e => setFormPrenomAr(e.target.value)} dir="rtl" className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" placeholder="الإسم بالعربية" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">Catégorie permis</label>
                      <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm">
                        {['A','B','C','D','E'].map(c => <option key={c} value={c}>{c}</option>)}
                        <option key="ALL" value="ALL">Toutes les catégories</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">Date d&apos;examen</label>
                      <input type="date" value={formExamDate} onChange={e => setFormExamDate(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">Code PIN</label>
                      <input type="text" maxLength={4} value={formPin} onChange={e => setFormPin(e.target.value.replace(/\D/g, ''))} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" placeholder="4 chiffres ou vide" />
                    </div>
                    {!editingUser && (
                      <div>
                        <label className="block text-gray-300 text-xs mb-1">Mot de passe</label>
                        <input type="text" value={formPassword} onChange={e => setFormPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" placeholder="Défaut: 1234" />
                      </div>
                    )}
                  </div>
                  {formMessage && (
                    <div className={`px-3 py-1 rounded text-sm mb-2 ${formMsgType === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{formMessage}</div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleSaveUser} disabled={savingUser || formPhotoUploading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                      {savingUser || formPhotoUploading ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {formPhotoUploading ? 'Upload photo...' : 'Enregistrement...'}
                        </span>
                      ) : (editingUser ? '💾 Modifier' : '➕ Créer')}
                    </button>
                    <button onClick={() => { setShowUserForm(false); resetUserForm(); }} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm" disabled={savingUser || formPhotoUploading}>Annuler</button>
                  </div>
                </div>
              )}

              {/* Tableau utilisateurs */}
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-300">Photo</th>
                      <th className="px-3 py-2 text-left text-gray-300">CIN</th>
                      <th className="px-3 py-2 text-left text-gray-300">Nom (FR)</th>
                      <th className="px-3 py-2 text-left text-gray-300">Nom (AR)</th>
                      <th className="px-3 py-2 text-left text-gray-300">Catégorie</th>
                      <th className="px-3 py-2 text-left text-gray-300">Examen</th>
                      <th className="px-3 py-2 text-left text-gray-300">PIN</th>
                      <th className="px-3 py-2 text-center text-gray-300">Statut</th>
                      <th className="px-3 py-2 text-center text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr><td colSpan={9} className="text-center py-8 text-gray-400">Chargement...</td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-8 text-gray-400">Aucun utilisateur</td></tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.cin} className="border-b border-gray-700 hover:bg-gray-800/50">
                          <td className="px-3 py-2">
                            {u.photo ? (
                              <img src={u.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs">👤</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-white font-mono">{u.cin}</td>
                          <td className="px-3 py-2 text-white">{u.prenomFr} {u.nomFr}</td>
                          <td className="px-3 py-2 text-white" dir="rtl">{u.prenomAr} {u.nomAr}</td>
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-white text-xs font-bold ${u.permisCategory === 'ALL' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-blue-600'}`}>{u.permisCategory === 'ALL' ? 'Toutes' : u.permisCategory}</span></td>
                          <td className="px-3 py-2 text-gray-300 text-xs">{u.examDate || '-'}</td>
                          <td className="px-3 py-2 text-gray-300 text-xs">{u.pinCode || <span className="text-green-400">Libre</span>}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleToggleActive(u.cin)} className={`px-3 py-1 rounded-full text-xs font-bold ${u.isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                              {u.isActive ? '✓ Actif' : '✗ Désactivé'}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleEditUser(u)} className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">✏️</button>
                              <button onClick={() => handleDeleteUser(u.cin)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-gray-400 text-xs text-right">Total: {users.length} utilisateur(s)</div>
            </div>
          )}

          {/* Tab: Administrateurs */}
          {activeTab === 'admins' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">🔑 Gestion des administrateurs</h3>
                <button onClick={() => { resetAdminForm(); setShowAdminForm(true); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm">➕ Nouvel administrateur</button>
              </div>

              {/* Formulaire administrateur */}
              {showAdminForm && (
                <div className="bg-gray-750 border border-gray-600 rounded-xl p-4 mb-4">
                  <h4 className="text-white font-bold mb-3">{editingAdmin ? '✏️ Modifier administrateur' : '➕ Nouvel administrateur'}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">Nom d'utilisateur *</label>
                      <input type="text" value={adminFormCin} onChange={e => setAdminFormCin(e.target.value.toUpperCase())} disabled={!!editingAdmin} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm disabled:opacity-50 uppercase" placeholder="Identifiant admin" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">{editingAdmin ? 'Nouveau mot de passe (laisser vide si inchangé)' : 'Mot de passe *'}</label>
                      <input type="password" value={adminFormPassword} onChange={e => setAdminFormPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" placeholder="Mot de passe" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs mb-1">Nom complet</label>
                      <input type="text" value={adminFormNom} onChange={e => setAdminFormNom(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-500 rounded text-white text-sm" placeholder="Nom de l'admin" />
                    </div>
                  </div>
                  {adminMessage && (
                    <div className={`mb-3 px-4 py-2 rounded-lg text-sm ${adminMsgType === 'error' ? 'bg-red-900/50 text-red-300 border border-red-500' : 'bg-green-900/50 text-green-300 border border-green-500'}`}>
                      {adminMessage}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleSaveAdmin} disabled={savingAdmin} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                      {savingAdmin ? '💾 Enregistrement...' : '💾 Enregistrer'}
                    </button>
                    <button onClick={() => { setShowAdminForm(false); resetAdminForm(); }} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm" disabled={savingAdmin}>Annuler</button>
                  </div>
                </div>
              )}

              {/* Liste des administrateurs */}
              {adminsLoading ? (
                <div className="text-center py-8"><div className="w-6 h-6 border-2 border-gray-400 border-t-white rounded-full animate-spin mx-auto mb-2"></div><p className="text-gray-400 text-sm">Chargement...</p></div>
              ) : admins.length === 0 ? (
                <div className="text-center py-8"><p className="text-gray-500">Aucun administrateur - لا يوجد مدراء</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-600">
                        <th className="text-left py-2 px-3 text-gray-300 font-bold">Identifiant</th>
                        <th className="text-left py-2 px-3 text-gray-300 font-bold">Nom</th>
                        <th className="text-left py-2 px-3 text-gray-300 font-bold">Statut</th>
                        <th className="text-left py-2 px-3 text-gray-300 font-bold">Créé le</th>
                        <th className="text-center py-2 px-3 text-gray-300 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((a) => (
                        <tr key={a.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                          <td className="px-3 py-2">
                            <span className="text-yellow-400 font-bold">{a.cin}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-300">{a.nomFr || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-white text-xs font-bold ${a.isActive ? 'bg-green-600' : 'bg-red-600'}`}>
                              {a.isActive ? '✓ Actif' : '✗ Désactivé'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleEditAdmin(a)} className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">✏️</button>
                              <button onClick={() => handleDeleteAdmin(a.cin)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 text-gray-400 text-xs text-right">Total: {admins.length} administrateur(s)</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Êtes-vous sûr de vouloir supprimer la <strong>série {deleteTarget.serie}</strong> de la <strong>catégorie {deleteTarget.category}</strong> ?
                  <br />
                  <span className="text-red-400 font-bold">Cette action est irréversible.</span> Toutes les questions et réponses associées seront définitivement supprimées.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSerie}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              🗑️ Oui, supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ===== APPLICATION PRINCIPALE =====
export default function DrivingTestApp() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<number>(1);
  const [selectedChronoTime, setSelectedChronoTime] = useState<number>(15);
  const [melangeQuestions, setMelangeQuestions] = useState<QuestionData[] | null>(null);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  const handleLogin = (user: UserData) => {
    setCurrentUser(user);
    setUserRole(user.role === 'admin' ? 'admin' : 'user');
    setScreen(user.role === 'admin' ? 'admin' : 'categories');
  };
  const handleAdminLogin = () => { setUserRole('admin'); setCurrentUser(null); setScreen('admin'); };
  const handleLogout = () => { setUserRole(null); setCurrentUser(null); setScreen('login'); setSelectedCategory(null); setMelangeQuestions(null); };
  const handleSelectCategory = (cat: Category) => { setSelectedCategory(cat); setScreen('series'); };
  const handleSelectSeries = (series: number, chronoTime: number) => { setMelangeQuestions(null); setSelectedSeries(series); setSelectedChronoTime(chronoTime); setScreen('password'); };
  const handleMelange = async (chronoTime: number) => {
    if (!selectedCategory) return;
    setSelectedChronoTime(chronoTime);
    try {
      const res = await fetch(`/api/questions/melange?category=${selectedCategory.id}`);
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setMelangeQuestions(data.questions);
        setSelectedSeries(0);
        setScreen('password');
      }
    } catch (error) {
      console.error('Error fetching melange questions:', error);
    }
  };
  const handlePasswordSuccess = () => { setScreen('counter'); };
  const handleCounterStart = () => { setScreen('test'); };
  const [testResult, setTestResult] = useState<{ questions: QuestionData[]; userAnswers: number[][]; score: number; total: number } | null>(null);
  const handleFinishTest = (result: { questions: QuestionData[]; userAnswers: number[][]; score: number; total: number }) => { setTestResult(result); setScreen('result'); };
  const handleRestart = () => { setScreen('password'); };
  const handleGoHome = () => { setScreen('categories'); setSelectedCategory(null); setMelangeQuestions(null); };

  return (
    <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif" }}>
      {screen === "login" && <LoginScreen onLogin={handleLogin} onAdminLogin={handleAdminLogin} />}
      {screen === "categories" && <CategoriesScreen user={currentUser} onSelectCategory={handleSelectCategory} onLogout={handleLogout} onProfile={() => setScreen('profile')} />}
      {screen === "series" && selectedCategory && <SeriesScreen category={selectedCategory} onSelectSeries={handleSelectSeries} onMelange={handleMelange} onBack={handleGoHome} />}
      {screen === "password" && selectedCategory && <PasswordScreen category={selectedCategory} series={selectedSeries} userCin={currentUser?.cin || ''} userPin={currentUser?.pinCode || ''} userPhoto={currentUser?.photo || null} onSuccess={handlePasswordSuccess} onBack={() => setScreen('series')} />}
      {screen === "counter" && selectedCategory && <CounterScreen category={selectedCategory} series={selectedSeries} onStart={handleCounterStart} />}
      {screen === "test" && selectedCategory && <TestScreen category={selectedCategory} series={selectedSeries} chronoTime={selectedChronoTime} melangeQuestions={melangeQuestions || undefined} user={currentUser} onFinish={handleFinishTest} onBack={() => setScreen('series')} />}
      {screen === "result" && selectedCategory && testResult && <ResultScreen score={testResult.score} total={testResult.total} onRestart={handleRestart} onHome={handleGoHome} onCorrection={() => setScreen('correction')} />}
      {screen === "correction" && selectedCategory && testResult && <CorrectionScreen questions={testResult.questions} userAnswers={testResult.userAnswers} onBack={() => setScreen('result')} />}
      {screen === "admin" && <AdminPanel onBack={handleLogout} />}
      {screen === "profile" && currentUser && <UserProfileScreen user={currentUser} onBack={() => setScreen('categories')} onLogout={handleLogout} />}
    </div>
  );
}
