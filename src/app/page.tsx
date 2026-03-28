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
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Précharger les images des catégories
  useEffect(() => {
    let loadedCount = 0;
    const totalImages = categoriesData.length;
    
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        setImagesLoaded(true);
      }
    };

    categoriesData.forEach((cat) => {
      const img = new window.Image();
      img.onload = checkAllLoaded;
      img.onerror = checkAllLoaded;
      img.src = cat.image;
    });
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
                <div className="w-full h-36 relative mb-2 transition-transform duration-200 group-hover:scale-105">
                  <Image src={cat.image} alt={cat.name} fill className="object-contain p-2 transition-all duration-200 group-hover:scale-110 group-hover:brightness-110 brightness-105" />
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

// ===== ÉCRAN MOT DE PASSE (NOUVEAU DESIGN) =====
const PasswordScreen = ({ category, series, onSuccess, onBack }: { category: Category; series: number; onSuccess: () => void; onBack: () => void }) => {
  const [code, setCode] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);

  // Précharger l'image de fond
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(true);
    img.src = '/images/pin-screen-bg.jpg';
    
    // Précharger aussi les boutons
    new window.Image().src = '/images/btn-fermer-new.png';
    new window.Image().src = '/images/btn-corriger.png';
  }, []);

  // Activer le plein écran et rotation horizontale automatiquement au chargement
  useEffect(() => {
    const enterFullscreenAndRotate = async () => {
      try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen) {
          (elem as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
        } else if ((elem as unknown as { msRequestFullscreen: () => void }).msRequestFullscreen) {
          (elem as unknown as { msRequestFullscreen: () => void }).msRequestFullscreen();
        }
        
        if (screen.orientation && screen.orientation.lock) {
          try {
            await screen.orientation.lock('landscape');
          } catch {
            console.log('Orientation lock not supported');
          }
        }
      } catch {
        console.log('Fullscreen or orientation lock not available');
      }
    };
    
    enterFullscreenAndRotate();
  }, []);

  // Redirection automatique quand 4 chiffres sont saisis
  useEffect(() => {
    if (code.length === 4) {
      const timer = setTimeout(() => {
        onSuccess();
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Fonction pour jouer un son de clic
  const playClickSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 600;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
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

  // Afficher un écran de chargement pendant le chargement de l'image
  if (!imageLoaded) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Chargement...</div>
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
      {/* Zone d'affichage du code PIN - 4 cases */}
      <div className="absolute flex gap-3" style={{ bottom: '30%', right: '12.5%' }}>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="relative" style={{ width: '53px', height: '63px' }}>
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
                <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '36px', fontWeight: 'bold', color: '#FF0000' }}>
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
          width: 'clamp(100px, 15vw, 220px)',
          height: 'clamp(60px, 10vh, 120px)'
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
          right: '13%', 
          bottom: '8%', 
          width: 'clamp(100px, 15vw, 220px)',
          height: 'clamp(60px, 10vh, 160px)'
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

  // Afficher un écran de chargement pendant le chargement de l'image
  if (!imageLoaded) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Chargement...</div>
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
    />
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
      {screen === "counter" && selectedCategory && <CounterScreen category={selectedCategory} series={selectedSeries} onStart={handleCounterStart} />}
      {screen === "test" && selectedCategory && <TestScreen category={selectedCategory} series={selectedSeries} onFinish={handleFinishTest} onBack={() => setScreen("series")} />}
      {screen === "result" && selectedCategory && <ResultScreen score={30} total={selectedCategory.questionsPerSeries} onRestart={handleRestart} onHome={handleGoHome} />}
      {screen === "admin" && <AdminPanel onBack={handleLogout} />}
    </div>
  );
}
