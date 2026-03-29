"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  const [orientationChecked, setOrientationChecked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

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
      '/images/chif-display.jpg'
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
        onSuccess();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [code, onSuccess]);

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
      {/* Code PIN par défaut - "AB123456" */}
      <div className="absolute flex items-center" style={{ top: '66%', left: '30%' }}>
        <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '1.8vw', fontWeight: 'bold', color: 'white' }}>
          AB123456
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
    />
  );
};

// ===== ÉCRAN DE TEST =====
interface QuestionData {
  id: string;
  order: number;
  image: string;
  audio: string;
  video: string | null;
  responseImage: string;
  duration: number;
  responses: { id: string; order: number; text: string; isCorrect: boolean }[];
}

const TestScreen = ({ category, series, onFinish, onBack }: { category: Category; series: number; onFinish: () => void; onBack: () => void }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [orientationChecked, setOrientationChecked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Charger les questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`/api/questions?category=${category.id}&serie=${series}`);
        const data = await res.json();
        if (data.questions) {
          setQuestions(data.questions);
        }
      } catch (error) {
        console.error('Error loading questions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [category.id, series]);

  // Jouer l'audio de la question actuelle
  useEffect(() => {
    if (questions.length > 0 && questions[currentQuestion]?.audio) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(questions[currentQuestion].audio);
      audioRef.current.play().catch(() => {});
    }
  }, [questions, currentQuestion]);

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
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setSelectedAnswers([]);
    } else {
      onFinish();
    }
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
          <button onClick={onBack} className="bg-red-500 px-6 py-2 rounded-lg">Retour</button>
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
      {/* Zone noire pour afficher l'image de la question */}
      <div 
        className="absolute bg-black border-[6px] border-white"
        style={{
          top: '7%',
          left: '3.5%',
          width: '73%',
          height: '77%'
        }}
      >
        {question.image && (
          <Image 
            src={question.image}
            alt={`Question ${question.order}`}
            fill
            className="object-contain"
            unoptimized
          />
        )}
      </div>

      {/* Image de la réponse (affichée en bas à droite) */}
      {question.responseImage && (
        <div 
          className="absolute border-2 border-white rounded"
          style={{
            bottom: '8%',
            right: '2%',
            width: '22%',
            height: '35%'
          }}
        >
          <Image 
            src={question.responseImage}
            alt="Réponse"
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      )}

      {/* Boutons de réponse */}
      <div 
        className="absolute flex gap-2"
        style={{
          bottom: '12%',
          left: '5%',
          width: '65%'
        }}
      >
        {[1, 2, 3, 4].map((num) => (
          <button
            key={num}
            onClick={() => handleSelectAnswer(num)}
            className={`flex-1 py-3 rounded-lg font-bold text-lg transition-all ${
              selectedAnswers.includes(num) 
                ? 'bg-yellow-500 text-black' 
                : 'bg-gray-700/80 text-white hover:bg-gray-600'
            }`}
          >
            {num}
          </button>
        ))}
      </div>

      {/* Numéro de question et progression */}
      <div 
        className="absolute text-white font-bold"
        style={{
          top: '1%',
          left: '2%',
          fontSize: 'clamp(14px, 1.5vw, 20px)'
        }}
      >
        {question.order} / {questions.length}
      </div>

      {/* Bouton Suivant */}
      <button
        onClick={handleNext}
        className="absolute bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg"
        style={{
          bottom: '3%',
          right: '3%'
        }}
      >
        {currentQuestion < questions.length - 1 ? 'التالي →' : 'إنهاء ✓'}
      </button>

      {/* Bouton Stop en haut à droite de l'écran */}
      <div className="absolute group" style={{ top: '1%', right: '1%' }}>
        <button
          onClick={onBack}
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
type AdminTab = 'import' | 'series' | 'users';

interface QuestionView {
  id: string;
  order: number;
  image: string;
  audio: string;
  video: string | null;
  responseImage: string;
  responses: { order: number; isCorrect: boolean }[];
}

const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('import');
  const [category, setCategory] = useState<string>('A');
  const [serie, setSerie] = useState<number>(1);
  const [seriesData, setSeriesData] = useState<{ category: string; serie: number; questions: number }[]>([]);
  
  // Media upload states
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaResult, setMediaResult] = useState<{ success: boolean; message: string } | null>(null);

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

  // Charger les données des séries
  useEffect(() => {
    loadSeriesData();
  }, []);

  const loadSeriesData = async () => {
    try {
      const res = await fetch('/api/questions/import');
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
      const res = await fetch('/api/upload/rar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      // Always show verification modal if we have verification data (even with errors)
      if (data.verification) {
        setVerificationResult(data.verification);
        setShowVerificationModal(true);
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
      setMediaResult({ 
        success: false, 
        message: `❌ Erreur de connexion:\n\n• ${errorMessage}\n\nVérifiez votre connexion réseau et réessayez.` 
      });
    } finally {
      setVerifying(false);
    }
  };

  // Confirm import after verification
  const handleConfirmImport = async () => {
    setShowVerificationModal(false);
    await handleMediaUpload(true);
  };

  // Cancel verification
  const handleCancelVerification = () => {
    setShowVerificationModal(false);
    setVerificationResult(null);
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
      const res = await fetch('/api/upload/rar', {
        method: 'POST',
        body: formData,
      });
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
    } catch {
      setMediaResult({ success: false, message: '❌ Erreur de connexion' });
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
      const data = await res.json();
      if (data.questions) {
        setQuestionsView(data.questions.map((q: QuestionView) => ({
          id: q.id,
          order: q.order,
          image: q.image,
          audio: q.audio,
          video: q.video,
          responseImage: q.responseImage,
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

  // Delete a serie
  const handleDeleteSerie = async (cat: string, ser: number) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la série ${ser} de la catégorie ${cat}?`)) return;
    
    try {
      // Delete via API (we'll need to create this)
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
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>Série {n}</option>
                    ))}
                  </select>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                        <div className="bg-gray-700 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-orange-400">{verificationResult.responses.count}</div>
                          <div className="text-gray-400 text-sm">Réponses</div>
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
                                <th className="px-2 py-1 text-center text-gray-300">Réponse</th>
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
                                  <td className="px-2 py-1 text-center">
                                    {q.hasResponse ? (
                                      q.responseValid ? 
                                        <span className="text-green-400" title="Réponse valide">✅</span> : 
                                        <span className="text-red-400" title="Réponse corrompue!">⚠️</span>
                                    ) : (
                                      <span className="text-red-400" title="Réponse manquante">❌</span>
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

                    {/* Footer */}
                    <div className="px-4 py-3 bg-gray-700 flex gap-4 justify-end">
                      <button
                        onClick={handleCancelVerification}
                        className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-bold"
                      >
                        ❌ Annuler
                      </button>
                      {verificationResult.isValid && (
                        <button
                          onClick={handleConfirmImport}
                          disabled={uploadingMedia}
                          className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold disabled:opacity-50"
                        >
                          {uploadingMedia ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Import...
                            </span>
                          ) : (
                            '✅ Confirmer l\'import'
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
                  {seriesData.length === 0 ? (
                    <div className="text-gray-400 text-center py-8">
                      <p className="text-4xl mb-4">📭</p>
                      <p>Aucune série importée</p>
                      <p className="text-sm">Utilisez l&apos;onglet Importer pour ajouter des questions</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <div className="grid grid-cols-4 bg-gray-700 text-gray-300 font-bold px-4 py-2 rounded-lg">
                        <span>Catégorie</span>
                        <span>Série</span>
                        <span>Questions</span>
                        <span>Actions</span>
                      </div>
                      {seriesData.map((s, i) => (
                        <div key={i} className="grid grid-cols-4 bg-gray-700/50 text-white px-4 py-3 rounded-lg hover:bg-gray-700 items-center">
                          <span className="font-bold text-yellow-400">{s.category}</span>
                          <span>Série {s.serie}</span>
                          <span className="text-green-400">{s.questions} questions</span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => loadSerieQuestions(s.category, s.serie)}
                              className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm"
                            >
                              👁️ Voir
                            </button>
                            <button 
                              onClick={() => handleDeleteSerie(s.category, s.serie)}
                              className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm"
                            >
                              🗑️ Suppr
                            </button>
                          </div>
                        </div>
                      ))}
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
                      <div className="bg-gray-700 rounded-lg p-3 mb-4 text-white">
                        <span className="font-bold text-yellow-400">{selectedSerieView.category}</span>
                        <span className="mx-2">•</span>
                        <span>Série {selectedSerieView.serie}</span>
                        <span className="mx-2">•</span>
                        <span className="text-green-400">{questionsView.length} questions</span>
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
                              <th className="px-3 py-2 text-left">Réponse</th>
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
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {q.responseImage ? (
                                      <>
                                        <span className="text-green-400 text-xs">✅</span>
                                        <button 
                                          onClick={() => setViewResponseImage(q.responseImage)}
                                          className="bg-orange-600 hover:bg-orange-500 px-2 py-1 rounded text-xs font-bold transition-colors"
                                        >
                                          👁️ Voir
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
              <h3 className="text-xl font-bold text-white mb-4">👥 Gestion des utilisateurs</h3>
              <div className="text-gray-400 text-center py-8">
                <p className="text-4xl mb-4">🚧</p>
                <p>Fonctionnalité en cours de développement</p>
              </div>
            </div>
          )}
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
