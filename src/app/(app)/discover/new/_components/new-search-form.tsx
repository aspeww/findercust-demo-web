"use client";

import { useActionState, useState, useMemo } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUNTRIES,
  TR_CITIES,
  TR_CITIES_WITH_DISTRICTS,
  SECTORS,
  SEGMENTS,
} from "@/lib/geo-data";
import { createSearch, type NewSearchState } from "../../actions";

const ALL_DISTRICTS_VALUE = "__ALL_DISTRICTS__";

export function NewSearchForm() {
  const [state, formAction, pending] = useActionState<
    NewSearchState | undefined,
    FormData
  >(createSearch, undefined);

  const [country, setCountry] = useState("Türkiye");
  const [city, setCity] = useState<string>("Ankara");
  const [district, setDistrict] = useState<string>(ALL_DISTRICTS_VALUE);
  const [sector, setSector] = useState<string>("Diş Kliniği");
  const [segment, setSegment] = useState<string>("Genel");

  const districts = useMemo(
    () => TR_CITIES_WITH_DISTRICTS[city] ?? [],
    [city],
  );

  // Reset district if city changes
  const handleCityChange = (next: string) => {
    setCity(next);
    setDistrict(ALL_DISTRICTS_VALUE);
  };

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden inputs to carry select state */}
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="city" value={city} />
      <input
        type="hidden"
        name="district"
        value={district === ALL_DISTRICTS_VALUE ? "" : district}
      />
      <input type="hidden" name="sector" value={sector} />
      <input type="hidden" name="segment" value={segment} />

      <div>
        <h1 className="text-2xl font-semibold">Yeni Arama</h1>
        <p className="text-sm text-muted-foreground">
          Hedef bölge, sektör ve müşteri kitlesini belirleyin. Sistem
          potansiyel müşteri listesini oluşturacak.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hedef Kitle</CardTitle>
          <CardDescription>
            Daha spesifik kriterler daha kaliteli sonuçlar getirir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Country / City / District */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Ülke</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Şehir</Label>
              <Select value={city} onValueChange={handleCityChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TR_CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bölge / İlçe</Label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="İl geneli" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DISTRICTS_VALUE}>İl geneli</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sector + Segment */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sektör / Alan</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger>
                  <SelectValue placeholder="ör. Diş kliniği, kafe…" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Müşteri Kitlesi (opsiyonel)</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={pending} size="lg">
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Aranıyor…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Aramayı Başlat
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
