// Questions de test du permis de conduire au Maroc
export interface Question {
  id: number;
  text: string;
  textAr: string;
  image?: string;
  audio?: string;
  answers: { key: string; text: string; textAr: string }[];
  correctAnswer: string;
}

export const questionsData: Question[] = [
  {
    id: 1,
    text: "Que signifie ce panneau ?",
    textAr: "ماذا يعني هذا اللوحة ؟",
    answers: [
      { key: "A", text: "Stop - Arrêt obligatoire", textAr: "توقف - إيقاف إلزامي" },
      { key: "B", text: "Cédez le passage", textAr: "أعطي الأسبقية" },
      { key: "C", text: "Sens interdit", textAr: "ممنوع الدخول" },
      { key: "D", text: "Vitesse limitée", textAr: "سرعة محدودة" }
    ],
    correctAnswer: "A"
  },
  {
    id: 2,
    text: "Quelle est la vitesse maximale autorisée en agglomération ?",
    textAr: "ما هي السرعة القصوى المسموح بها في المناطق العمرانية ؟",
    answers: [
      { key: "A", text: "40 km/h", textAr: "40 كم/س" },
      { key: "B", text: "50 km/h", textAr: "50 كم/س" },
      { key: "C", text: "60 km/h", textAr: "60 كم/س" },
      { key: "D", text: "80 km/h", textAr: "80 كم/س" }
    ],
    correctAnswer: "B"
  },
  {
    id: 3,
    text: "Que signifie un feu orange clignotant ?",
    textAr: "ماذا يعني الضوء البرتقالي الوامض ؟",
    answers: [
      { key: "A", text: "Passage interdit", textAr: "المرور ممنوع" },
      { key: "B", text: "Ralentir et céder le passage", textAr: "تباطأ وأعطي الأسبقية" },
      { key: "C", text: "Accélérez", textAr: "تسارع" },
      { key: "D", text: "Feu en panne", textAr: "ضوء معطل" }
    ],
    correctAnswer: "B"
  },
  {
    id: 4,
    text: "Quelle est la distance de sécurité minimale entre deux véhicules ?",
    textAr: "ما هي مسافة الأمان الدنيا بين مركبتين ؟",
    answers: [
      { key: "A", text: "10 mètres", textAr: "10 أمتار" },
      { key: "B", text: "20 mètres", textAr: "20 متراً" },
      { key: "C", text: "30 mètres", textAr: "30 متراً" },
      { key: "D", text: "50 mètres", textAr: "50 متراً" }
    ],
    correctAnswer: "A"
  },
  {
    id: 5,
    text: "En cas de brouillard intense, quels feux faut-il allumer ?",
    textAr: "في حالة الضباب الكثيف، ما هي الأضواء التي يجب تشغيلها ؟",
    answers: [
      { key: "A", text: "Feux de croisement", textAr: "أضواء التقاطع" },
      { key: "B", text: "Feux de route", textAr: "أضواء الطريق" },
      { key: "C", text: "Feux de brouillard", textAr: "أضواء الضباب" },
      { key: "D", text: "Feux de position", textAr: "أضواء الموقع" }
    ],
    correctAnswer: "C"
  },
  {
    id: 6,
    text: "Quelle est l'alcoolémie maximale autorisée au Maroc ?",
    textAr: "ما هو الحد الأقصى المسموح به للكحول في الدم في المغرب ؟",
    answers: [
      { key: "A", text: "0.2 g/l", textAr: "0.2 غ/ل" },
      { key: "B", text: "0.5 g/l", textAr: "0.5 غ/ل" },
      { key: "C", text: "0.8 g/l", textAr: "0.8 غ/ل" },
      { key: "D", text: "1.0 g/l", textAr: "1.0 غ/ل" }
    ],
    correctAnswer: "B"
  },
  {
    id: 7,
    text: "Que signifie ce panneau triangulaire avec un pictogramme de piétons ?",
    textAr: "ماذا يعني هذا اللوحة المثلثة التي تحمل رمز المشاة ؟",
    answers: [
      { key: "A", text: "Passage piétons", textAr: "معبر المشاة" },
      { key: "B", text: "Zone piétonne", textAr: "منطقة المشاة" },
      { key: "C", text: "Danger piétons", textAr: "خطر المشاة" },
      { key: "D", text: "Interdit aux piétons", textAr: "ممنوع على المشاة" }
    ],
    correctAnswer: "C"
  },
  {
    id: 8,
    text: "Quelle est la durée de validité d'un permis de conduire provisoire ?",
    textAr: "ما هي مدة صلاحية رخصة القيادة المؤقتة ؟",
    answers: [
      { key: "A", text: "6 mois", textAr: "6 أشهر" },
      { key: "B", text: "1 an", textAr: "سنة واحدة" },
      { key: "C", text: "2 ans", textAr: "سنتان" },
      { key: "D", text: "3 ans", textAr: "3 سنوات" }
    ],
    correctAnswer: "C"
  },
  {
    id: 9,
    text: "Que signifie une ligne continue blanche au milieu de la chaussée ?",
    textAr: "ماذا تعني الخط الأبيض المتصل في وسط الطريق ؟",
    answers: [
      { key: "A", text: "Dépassement autorisé", textAr: "التجاوز مسموح" },
      { key: "B", text: "Dépassement interdit", textAr: "التجاوز ممنوع" },
      { key: "C", text: "Voie réservée", textAr: "مسار محجوز" },
      { key: "D", text: "Fin de voie", textAr: "نهاية المسار" }
    ],
    correctAnswer: "B"
  },
  {
    id: 10,
    text: "Quel document est obligatoire pour conduire au Maroc ?",
    textAr: "ما هي الوثيقة الإلزامية للقيادة في المغرب ؟",
    answers: [
      { key: "A", text: "Carte d'identité", textAr: "بطاقة التعريف الوطنية" },
      { key: "B", text: "Permis de conduire", textAr: "رخصة القيادة" },
      { key: "C", text: "Assurance automobile", textAr: "تأمين السيارة" },
      { key: "D", text: "Tous les documents ci-dessus", textAr: "جميع الوثائق المذكورة أعلاه" }
    ],
    correctAnswer: "D"
  }
];

// Catégories de permis
export interface Category {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  color: string;
  vehicle: string;
}

export const categoriesData: Category[] = [
  {
    id: "A",
    name: "Moto",
    nameAr: "دراجة نارية",
    description: "Permis moto - 2 roues",
    color: "#3498db",
    vehicle: "motorcycle"
  },
  {
    id: "B",
    name: "Voiture",
    nameAr: "سيارة",
    description: "Permis voiture - VL",
    color: "#f39c12",
    vehicle: "car"
  },
  {
    id: "C",
    name: "Camion",
    nameAr: "شاحنة",
    description: "Permis camion - PL",
    color: "#2ecc71",
    vehicle: "truck"
  },
  {
    id: "D",
    name: "Bus",
    nameAr: "حافلة",
    description: "Permis bus - transports",
    color: "#9b59b6",
    vehicle: "bus"
  },
  {
    id: "E",
    name: "Remorque",
    nameAr: "مقطورة",
    description: "Permis remorque",
    color: "#2c3e50",
    vehicle: "trailer"
  }
];
