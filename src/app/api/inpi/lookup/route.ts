import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCompanyBySiren, parseINPIToProspect } from "@/services/inpi";

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
    const company = await getCompanyBySiren(siren);

    if (!company) {
      return NextResponse.json(
        { error: "Entreprise non trouvée" },
        { status: 404 }
      );
    }

    const data = parseINPIToProspect(company);

    return NextResponse.json({
      found: true,
      source: "INPI_RNE",
      ...data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur INPI";

    if (message.includes("INPI_USERNAME") || message.includes("INPI_PASSWORD")) {
      return NextResponse.json(
        { error: "API INPI non configurée" },
        { status: 503 }
      );
    }

    if (message.includes("auth failed")) {
      return NextResponse.json(
        { error: "Authentification INPI échouée - vérifiez vos identifiants" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
