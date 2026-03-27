"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";

// Types
type UserRole = "admin" | "user" | null;
type Screen = "login" | "categories" | "series" | "password" | "counter" | "test" | "result" | "admin";

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
const LoginScreen = ({ onLogin }: { onLogin: (role: UserRole) => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (username === "admin" && password === "admin123") {
      onLogin("admin");
    } else if (username === "user" && password === "user123") {
      onLogin("user");
    } else {
      setError("Identifiants incorrects");
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 flex items-center justify-center p-4">
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
            <label className="block text-gray-700 text-sm font-bold mb-2">Nom d&apos;utilisateur</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-gray-800" placeholder="Entrez votre login" />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-gray-800" placeholder="Entrez votre mot de passe" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
          </div>
          <button onClick={handleLogin} className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:from-blue-600 hover:to-blue-700 shadow-lg">Se connecter / تسجيل الدخول</button>
          <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs">
            <p className="text-center text-gray-600">Demo: admin/admin123 ou user/user123</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== ÉCRAN DES CATÉGORIES =====
const CategoriesScreen = ({ userRole, onSelectCategory, onLogout }: { userRole: UserRole; onSelectCategory: (cat: Category) => void; onLogout: () => void }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 relative overflow-hidden">
      <RoadSignsBackground />
      <div className="absolute inset-2 md:inset-4 border-2 md:border-4 border-gray-500 rounded-lg bg-gray-300/80 shadow-inner flex flex-col">
        <div className="bg-gray-500 text-white px-4 py-2 flex justify-between items-center rounded-t-lg">
          <div className="flex items-center gap-4">
            <span className="text-sm">{userRole === "admin" ? "👑 Admin" : "👤 User"}</span>
            <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-xs font-bold">❌ Déconnexion</button>
          </div>
          <div className="text-sm font-bold">المملكة المغربية</div>
        </div>
        <div className="text-center py-4">
          <h1 className="text-2xl md:text-4xl font-bold mb-1" style={{ color: '#FFD700', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>اختبار رخصة القيادة</h1>
          <div className="h-1 bg-yellow-500 mx-auto w-3/4 max-w-xl rounded-full shadow-lg" />
          <p className="text-gray-700 text-lg mt-2">Test du Permis de Conduire - Maroc</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {categoriesData.map((cat) => (
              <button key={cat.id} onClick={() => onSelectCategory(cat)} className="bg-white/90 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] group border-2 border-gray-300 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg group-hover:scale-110 transition-all mb-2" style={{ backgroundColor: cat.color }}>{cat.id}</div>
                <div className="w-full h-28 relative rounded overflow-hidden bg-gray-100 mb-2">
                  <Image src={cat.image} alt={cat.name} fill className="object-contain p-2" />
                </div>
                <p className="text-lg font-bold text-gray-800">{cat.name}</p>
                <p className="text-gray-600 text-sm" dir="rtl">{cat.nameAr}</p>
                <div className="mt-2 text-red-500 text-lg">▶</div>
              </button>
            ))}
          </div>
        </div>
        <div className="text-center py-2 text-gray-500 text-sm">المملكة المغربية - Royaume du Maroc</div>
      </div>
    </div>
  );
};

// ===== ÉCRAN SÉLECTION SÉRIE =====
const SeriesScreen = ({ category, onSelectSeries, onBack }: { category: Category; onSelectSeries: (series: number) => void; onBack: () => void }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-500 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
          <button onClick={onBack} className="bg-gray-600 hover:bg-gray-700 px-4 py-1 rounded font-bold">← Retour</button>
          <h2 className="text-xl font-bold">Catégorie {category.id} - {category.name}</h2>
          <div className="w-20"></div>
        </div>
        <div className="bg-white/90 rounded-b-lg p-6 shadow-xl">
          <div className="flex justify-center mb-4">
            <div className="w-32 h-24 relative">
              <Image src={category.image} alt={category.name} fill className="object-contain" />
            </div>
          </div>
          <h3 className="text-center text-gray-700 text-xl mb-4">اختر السلسلة - Choisissez une série</h3>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
            {Array.from({ length: category.seriesCount }, (_, i) => i + 1).map((num) => (
              <button key={num} onClick={() => onSelectSeries(num)} className="w-12 h-12 rounded-full text-white font-bold text-lg hover:scale-110 transition-all shadow-lg" style={{ backgroundColor: category.color }}>{num}</button>
            ))}
          </div>
          <div className="mt-6 text-center text-gray-600">
            <p>Chaque série contient {category.questionsPerSeries} questions</p>
          </div>
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

// ===== ÉCRAN MOT DE PASSE (STYLE EXACT IMAGE) =====
const PasswordScreen = ({ category, series, onSuccess, onBack }: { category: Category; series: number; onSuccess: () => void; onBack: () => void }) => {
  const [code, setCode] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Vérifier l'état du plein écran
  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', checkFullscreen);
    checkFullscreen();
    return () => document.removeEventListener('fullscreenchange', checkFullscreen);
  }, []);

  // Redirection automatique quand 4 chiffres sont saisis
  useEffect(() => {
    if (code.length === 4) {
      const timer = setTimeout(() => {
        // Entrer en plein écran avant de continuer
        if (!document.fullscreenElement) {
          enterFullscreen();
        }
        onSuccess();
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleKeyPress = (num: string) => {
    if (code.length < 4) {
      setCode(prev => prev + num);
    }
  };

  const handleCorrect = () => {
    setCode("");
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-2 md:p-4 relative" style={{ backgroundColor: '#8B8B9B' }}>
      {/* Bouton Plein Écran */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg font-bold text-white transition-all hover:opacity-90 flex items-center gap-2"
        style={{ backgroundColor: isFullscreen ? '#4CAF50' : '#2196F3' }}
      >
        {isFullscreen ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Quitter
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Plein écran
          </>
        )}
      </button>

      {/* Container principal avec bordure 3D */}
      <div className="w-full max-w-4xl rounded-lg overflow-hidden shadow-2xl" style={{ backgroundColor: '#F0F0F0', border: '4px solid #7A7A8A' }}>
        <div className="flex flex-col md:flex-row">
          
          {/* PARTIE GAUCHE - Avatar et Infos */}
          <div className="w-full md:w-1/2 p-4 md:p-6" style={{ backgroundColor: '#E8E8E8' }}>
            {/* Avatar */}
            <div className="w-28 h-28 md:w-36 md:h-36 mx-auto mb-4 md:mb-6 rounded-lg overflow-hidden shadow-lg border-4 border-white bg-gray-200 flex items-center justify-center">
              <svg className="w-16 h-16 md:w-20 md:h-20 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" />
                <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" />
              </svg>
            </div>

            {/* N°CIN */}
            <div className="mb-3 rounded overflow-hidden shadow flex">
              <div className="px-3 py-2 bg-white text-gray-700 font-medium text-sm border-r border-gray-300">N°CIN</div>
              <div className="flex-1 px-3 py-2 text-white font-bold text-center" style={{ backgroundColor: '#3498db' }}>________</div>
              <div className="px-3 py-2 bg-white text-gray-600 text-xs">بصمة اليد</div>
            </div>

            {/* Type de permis */}
            <div className="mb-3 rounded overflow-hidden shadow flex">
              <div className="px-3 py-2 bg-white text-gray-700 font-medium text-sm border-r border-gray-300">Type de</div>
              <div className="flex-1 px-3 py-2 text-white font-bold text-center" style={{ backgroundColor: '#3498db' }}>Catégorie {category.id}</div>
              <div className="px-3 py-2 bg-white text-gray-600 text-xs">فئة السيارة</div>
            </div>

            {/* Langue */}
            <div className="mb-3 rounded overflow-hidden shadow flex">
              <div className="px-3 py-2 bg-white text-gray-700 font-medium text-sm border-r border-gray-300">Langue</div>
              <div className="flex-1 px-3 py-2 text-white font-bold text-center" style={{ backgroundColor: '#3498db' }}>Arabe</div>
              <div className="px-3 py-2 bg-white text-gray-600 text-xs">اللغة</div>
            </div>

            {/* Série */}
            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">Série: <span className="font-bold">{series}</span></p>
            </div>
          </div>

          {/* PARTIE DROITE - Clavier */}
          <div className="w-full md:w-1/2 p-4 md:p-6" style={{ backgroundColor: '#4B0082' }}>
            {/* Titre */}
            <div className="text-center mb-4">
              <p className="text-white text-lg font-medium">Entrez votre mot de passe</p>
              <p className="text-white/80 text-sm" dir="rtl">أدخل رقمك السري</p>
            </div>

            {/* Affichage du code (4 cases) */}
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-12 h-12 rounded flex items-center justify-center text-2xl font-bold"
                  style={{
                    backgroundColor: i < code.length ? '#FFD700' : '#5A5A6A',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {i < code.length ? '●' : ''}
                </div>
              ))}
            </div>

            {/* Clavier numérique */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  className="h-14 rounded-lg text-gray-800 text-2xl font-bold transition-all active:scale-95"
                  style={{
                    backgroundColor: '#87CEEB',
                    boxShadow: '0 3px 0 #5A9BBF, inset 0 1px 0 rgba(255,255,255,0.4)'
                  }}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Bouton 0 */}
            <button
              onClick={() => handleKeyPress('0')}
              className="w-full h-14 rounded-lg text-gray-800 text-2xl font-bold transition-all active:scale-95 mb-4"
              style={{
                backgroundColor: '#FFFFFF',
                boxShadow: '0 3px 0 #CCCCCC, inset 0 1px 0 rgba(255,255,255,0.8)'
              }}
            >
              0
            </button>

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                onClick={handleCorrect}
                className="flex-1 py-3 rounded-lg font-bold transition-all"
                style={{
                  backgroundColor: '#E8E0F0',
                  color: '#CC0000',
                  boxShadow: '0 3px 0 #C8C0D0'
                }}
              >
                Corriger<br/><span className="text-xs" dir="rtl">تصحيح</span>
              </button>
              <button
                onClick={onBack}
                className="flex-1 py-3 rounded-lg font-bold text-white transition-all"
                style={{
                  backgroundColor: '#CC0000',
                  boxShadow: '0 3px 0 #8B0000'
                }}
              >
                Fermer<br/><span className="text-xs" dir="rtl">إغلاق</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== ÉCRAN COMPTEUR AVANT TEST =====
const CounterScreen = ({ category, series, onStart, onCancel }: { category: Category; series: number; onStart: () => void; onCancel: () => void }) => {
  const [countdown, setCountdown] = useState(5);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // S'assurer qu'on est en plein écran
  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', checkFullscreen);
    checkFullscreen();
    
    // Entrer en plein écran si pas déjà
    if (!document.fullscreenElement) {
      enterFullscreen();
    }
    
    return () => document.removeEventListener('fullscreenchange', checkFullscreen);
  }, []);

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

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative" style={{ backgroundColor: '#9B9BB0' }}>
      {/* Bouton Plein Écran */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg font-bold text-white transition-all hover:opacity-90 flex items-center gap-2"
        style={{ backgroundColor: isFullscreen ? '#4CAF50' : '#2196F3' }}
      >
        {isFullscreen ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Quitter
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Plein écran
          </>
        )}
      </button>

      {/* Container avec bordure 3D */}
      <div className="w-full max-w-lg rounded-lg overflow-hidden shadow-2xl" style={{ border: '6px solid #6B6B7B', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), 0 8px 16px rgba(0,0,0,0.3)' }}>
        {/* Contenu principal */}
        <div className="p-8" style={{ backgroundColor: '#F5F5F5' }}>
          {/* Icône serveur avec flèche verte */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              {/* Serveur */}
              <div className="w-20 h-24 rounded-lg flex flex-col items-center justify-center gap-1" style={{ backgroundColor: '#B0B0B0', boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3)' }}>
                <div className="w-12 h-2 rounded" style={{ backgroundColor: '#505050' }} />
                <div className="w-12 h-2 rounded" style={{ backgroundColor: '#505050' }} />
                <div className="w-12 h-2 rounded" style={{ backgroundColor: '#505050' }} />
                <div className="w-8 h-1 rounded mt-1" style={{ backgroundColor: '#00FF00' }} />
              </div>
              {/* Flèche verte circulaire */}
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#4CAF50', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </div>

          {/* Texte français */}
          <p className="text-center text-gray-800 text-xl font-medium mb-2">
            L&apos;examen va commencer dans quelques secondes
          </p>

          {/* Texte arabe */}
          <p className="text-center text-gray-700 text-lg" dir="rtl">
            سيبدأ الامتحان خلال ثوانٍ قليلة
          </p>

          {/* Compteur */}
          <div className="flex justify-center mt-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold text-white" style={{ backgroundColor: '#4B0082', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>
              {countdown}
            </div>
          </div>

          {/* Info catégorie et série */}
          <div className="text-center mt-6 text-gray-600 text-sm">
            <p>Catégorie {category.id} | Série {series}</p>
          </div>

          {/* Bouton Annuler */}
          <div className="flex justify-center mt-4">
            <button
              onClick={onCancel}
              className="px-6 py-2 rounded-lg font-bold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: '#CC0000', boxShadow: '0 3px 0 #8B0000' }}
            >
              Annuler / إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== ÉCRAN DE TEST =====
const TestScreen = ({ category, series, onFinish, onBack }: { category: Category; series: number; onFinish: () => void; onBack: () => void }) => {
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const totalQuestions = category.questionsPerSeries || 1;

  // S'assurer qu'on est en plein écran
  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', checkFullscreen);
    checkFullscreen();
    
    // Entrer en plein écran si pas déjà
    if (!document.fullscreenElement) {
      enterFullscreen();
    }
    
    return () => document.removeEventListener('fullscreenchange', checkFullscreen);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  const progressPercent = Math.max(0, Math.min(100, (currentQuestion / totalQuestions) * 100));

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  const handleQuit = () => {
    if (document.fullscreenElement) {
      exitFullscreen();
    }
    onBack();
  };

  return (
    <div className="min-h-screen w-full bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center">
        <button onClick={handleQuit} className="bg-red-600 hover:bg-red-700 px-4 py-1 rounded font-bold">✕ Quitter</button>
        <div className="flex items-center gap-4">
          <span className="font-bold">Cat {category.id} | Série {series}</span>
          <span className="text-yellow-400 font-bold">⏱ {formatTime(timeLeft)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFullscreen}
            className={`px-3 py-1 rounded font-bold flex items-center gap-1 ${isFullscreen ? 'bg-green-600' : 'bg-blue-600'}`}
          >
            {isFullscreen ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Quitter FS
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Plein écran
              </>
            )}
          </button>
          <span className="bg-gray-700 px-3 py-1 rounded">{currentQuestion}/{totalQuestions}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-700">
        <div className="h-full transition-all" style={{ width: `${progressPercent}%`, backgroundColor: category.color }} />
      </div>

      {/* Contenu */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4">
        <div className="md:w-1/2 flex flex-col gap-4">
          <div className="flex-1 bg-gray-900 rounded-lg flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <div className="text-8xl mb-2">🪧</div>
              <p className="text-gray-400">Image de la question</p>
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="font-bold text-white text-center">Que signifie ce panneau ?</p>
            <p className="text-gray-300 text-center text-sm" dir="rtl">ماذا يعني هذا اللوحة؟</p>
          </div>
        </div>

        <div className="md:w-1/2 flex flex-col gap-4">
          <div className="flex-1 grid grid-cols-2 gap-4">
            {['A', 'B', 'C', 'D'].map((letter) => (
              <button
                key={letter}
                onClick={() => setSelectedAnswer(letter)}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${selectedAnswer === letter ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-100 border-gray-300 hover:border-green-400'}`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${selectedAnswer === letter ? 'bg-white text-green-600' : 'text-white'}`} style={{ backgroundColor: selectedAnswer === letter ? undefined : category.color }}>{letter}</span>
                <span className="font-medium">Réponse {letter}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <button onClick={() => { setCurrentQuestion(Math.max(1, currentQuestion - 1)); setSelectedAnswer(null); }} disabled={currentQuestion === 1} className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-bold disabled:opacity-50">← Précédent</button>
            {currentQuestion < totalQuestions ? (
              <button onClick={() => { setCurrentQuestion(currentQuestion + 1); setSelectedAnswer(null); }} disabled={!selectedAnswer} className="flex-1 py-3 text-white rounded-lg font-bold disabled:opacity-50" style={{ backgroundColor: selectedAnswer ? category.color : '#9ca3af' }}>Suivant →</button>
            ) : (
              <button onClick={onFinish} disabled={!selectedAnswer} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold disabled:opacity-50 hover:bg-green-700">✓ Terminer</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== ÉCRAN RÉSULTAT =====
const ResultScreen = ({ score, total, onRestart, onHome }: { score: number; total: number; onRestart: () => void; onHome: () => void }) => {
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 75;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 flex items-center justify-center p-4">
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
      </div>
    </div>
  );
};

// ===== PANEL ADMIN =====
const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-500 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
          <button onClick={onBack} className="bg-gray-600 hover:bg-gray-700 px-4 py-1 rounded font-bold">← Retour</button>
          <h2 className="text-xl font-bold">👑 Panel Administrateur</h2>
        </div>
        <div className="bg-white/90 rounded-b-lg p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Gestion des données</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-100 rounded-lg p-4">
              <h4 className="font-bold text-gray-700 mb-2">📂 Gérer les séries</h4>
              <button className="mt-3 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Accéder</button>
            </div>
            <div className="bg-gray-100 rounded-lg p-4">
              <h4 className="font-bold text-gray-700 mb-2">❓ Gérer les questions</h4>
              <button className="mt-3 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Accéder</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== APPLICATION PRINCIPALE =====
export default function DrivingTestApp() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<number>(1);

  const handleLogin = (role: UserRole) => { setUserRole(role); setScreen(role === "admin" ? "admin" : "categories"); };
  const handleLogout = () => { setUserRole(null); setScreen("login"); setSelectedCategory(null); };
  const handleSelectCategory = (cat: Category) => { setSelectedCategory(cat); setScreen("series"); };
  const handleSelectSeries = (series: number) => { setSelectedSeries(series); setScreen("password"); };
  const handlePasswordSuccess = () => { setScreen("counter"); };
  const handleCounterStart = () => { setScreen("test"); };
  const handleFinishTest = () => { setScreen("result"); };
  const handleRestart = () => { setScreen("password"); };
  const handleGoHome = () => { setScreen("categories"); setSelectedCategory(null); };

  return (
    <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif" }}>
      {screen === "login" && <LoginScreen onLogin={handleLogin} />}
      {screen === "categories" && <CategoriesScreen userRole={userRole} onSelectCategory={handleSelectCategory} onLogout={handleLogout} />}
      {screen === "series" && selectedCategory && <SeriesScreen category={selectedCategory} onSelectSeries={handleSelectSeries} onBack={handleGoHome} />}
      {screen === "password" && selectedCategory && <PasswordScreen category={selectedCategory} series={selectedSeries} onSuccess={handlePasswordSuccess} onBack={() => setScreen("series")} />}
      {screen === "counter" && selectedCategory && <CounterScreen category={selectedCategory} series={selectedSeries} onStart={handleCounterStart} onCancel={() => setScreen("password")} />}
      {screen === "test" && selectedCategory && <TestScreen category={selectedCategory} series={selectedSeries} onFinish={handleFinishTest} onBack={() => setScreen("counter")} />}
      {screen === "result" && selectedCategory && <ResultScreen score={30} total={selectedCategory.questionsPerSeries} onRestart={handleRestart} onHome={handleGoHome} />}
      {screen === "admin" && <AdminPanel onBack={handleLogout} />}
    </div>
  );
}
