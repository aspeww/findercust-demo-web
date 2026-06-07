// Comprehensive list of Turkish cities + selected districts + sectors.
// Used for Discover form selects.

export const COUNTRIES = [
  { code: "TR", name: "Türkiye" },
] as const;

export type CityKey = string;

export const TR_CITIES_WITH_DISTRICTS: Record<CityKey, string[]> = {
  İstanbul: [
    "Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler",
    "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü",
    "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt",
    "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane",
    "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer",
    "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla",
    "Ümraniye", "Üsküdar", "Zeytinburnu",
  ],
  Ankara: [
    "Altındağ", "Çankaya", "Etimesgut", "Gölbaşı", "Keçiören", "Mamak",
    "Polatlı", "Pursaklar", "Sincan", "Yenimahalle",
  ],
  İzmir: [
    "Balçova", "Bayraklı", "Bornova", "Buca", "Çiğli", "Gaziemir",
    "Karabağlar", "Karşıyaka", "Konak", "Menemen", "Narlıdere", "Urla",
  ],
  Bursa: [
    "Gemlik", "Gürsu", "İnegöl", "Kestel", "Mudanya", "Nilüfer", "Osmangazi",
    "Yıldırım",
  ],
  Antalya: [
    "Aksu", "Alanya", "Döşemealtı", "Kepez", "Konyaaltı", "Manavgat",
    "Muratpaşa", "Serik",
  ],
  Adana: [
    "Çukurova", "Sarıçam", "Seyhan", "Yüreğir",
  ],
  Konya: [
    "Karatay", "Meram", "Selçuklu",
  ],
  Eskişehir: [
    "Odunpazarı", "Tepebaşı",
  ],
  Gaziantep: [
    "Şahinbey", "Şehitkamil", "Oğuzeli",
  ],
  Mersin: [
    "Akdeniz", "Mezitli", "Toroslar", "Yenişehir",
  ],
  Kayseri: ["Kocasinan", "Melikgazi", "Talas"],
  Trabzon: ["Akçaabat", "Ortahisar", "Yomra"],
  Samsun: ["Atakum", "Canik", "İlkadım"],
  Diyarbakır: ["Bağlar", "Kayapınar", "Sur", "Yenişehir"],
  Şanlıurfa: ["Eyyübiye", "Haliliye", "Karaköprü"],
};

export const TR_CITIES = Object.keys(TR_CITIES_WITH_DISTRICTS);

export const SECTORS = [
  "Diş Kliniği",
  "Veteriner Kliniği",
  "Kuaför",
  "Berber",
  "Güzellik Salonu",
  "Restoran",
  "Kafe",
  "Pastane",
  "Pizza",
  "Dönerci",
  "Spor Salonu",
  "Yoga Stüdyosu",
  "Pilates Stüdyosu",
  "Oto Yıkama",
  "Oto Tamir",
  "Lastikçi",
  "Eczane",
  "Optik / Gözlükçü",
  "Fizyoterapi",
  "Psikolog",
  "Avukat",
  "Mali Müşavir",
  "Emlakçı",
  "Mimarlık Ofisi",
  "İç Mimar",
  "Çiçekçi",
  "Pet Shop",
  "Anaokulu",
  "Kurs / Eğitim Merkezi",
  "Sürücü Kursu",
  "Çamaşırhane / Kuru Temizleme",
  "Halı Yıkama",
  "Tekstil",
  "Mobilyacı",
  "Dekorasyon",
  "Hediyelik Eşya",
  "Düğün Salonu",
  "Fotoğrafçı",
  "Matbaa",
  "Bilgisayar / Teknik Servis",
  "Güvenlik Sistemleri (Kamera / Yangın Alarm)",
] as const;

export const SEGMENTS = [
  "Genel",
  "Aile / 25-45",
  "Genç / 18-30",
  "Kurumsal / B2B",
  "Lüks / Premium",
  "Ekonomik / Bütçe dostu",
  "Yaşlı / 55+",
  "Çocuk / Aile",
  "Profesyonel",
  "Turistik",
] as const;

export const RADIUS_OPTIONS = [1, 2, 5, 10, 14, 20, 25, 30, 40, 50] as const;
