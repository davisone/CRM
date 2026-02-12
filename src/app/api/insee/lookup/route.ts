import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUniteLegaleBySiren,
  searchSiegeParSiren,
  parseINSEEToProspectData,
} from "@/services/insee";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const siren = request.nextUrl.searchParams.get("siren");

  if (!siren || !/^\d{9}$/.test(siren)) {
    return NextResponse.json(
      { error: "SIREN invalide (9 chiffres requis)" },
      { status: 400 }
    );
  }

  try {
    const [uniteLegale, etablissement] = await Promise.all([
      getUniteLegaleBySiren(siren),
      searchSiegeParSiren(siren),
    ]);

    if (!uniteLegale) {
      return NextResponse.json(
        { error: "Entreprise non trouvée" },
        { status: 404 }
      );
    }

    const data = parseINSEEToProspectData(uniteLegale, etablissement);

    return NextResponse.json({
      found: true,
      siren,
      ...data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur INSEE";

    // Si pas de clé API configurée, retourner une erreur explicite
    if (message.includes("INSEE_API_KEY")) {
      return NextResponse.json(
        { error: "API INSEE non configurée" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}