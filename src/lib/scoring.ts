import type { Prospect, NafSection } from "@prisma/client";

export interface ScoringDetails {
  noWebsite: number;
  weakWebsite: number;
  youngCompany: number;
  highValueSector: number;
  directorContactable: number;
  companySize: number;
  googleWithoutWebsite: number;
  total: number;
}

export interface ScoringContext {
  hasDirectorContact: boolean;
  nafSections: NafSection[];
}

export function scoreProspect(
  prospect: Prospect,
  context: ScoringContext
): { score: number; priority: number; details: ScoringDetails } {
  const details: ScoringDetails = {
    noWebsite: 0,
    weakWebsite: 0,
    youngCompany: 0,
    highValueSector: 0,
    directorContactable: 0,
    companySize: 0,
    googleWithoutWebsite: 0,
    total: 0,
  };

  // No website: 30 points
  if (!prospect.website) {
    details.noWebsite = 30;
  }
  // Weak website (quality < 30): 15 points
  else if (prospect.websiteQuality !== null && prospect.websiteQuality < 30) {
    details.weakWebsite = 15;
  }

  // Young company (< 3 months): 20 points
  if (prospect.creationDate) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (prospect.creationDate > threeMonthsAgo) {
      details.youngCompany = 20;
    }
  }

  // High value sector (NAF): 20 points
  if (prospect.nafCode) {
    const sectionCode = prospect.nafCode.substring(0, 2);
    const nafSection = context.nafSections.find(
      (s) => s.code === sectionCode || s.code === prospect.nafCode
    );
    if (nafSection?.isHighValue) {
      details.highValueSector = nafSection.scoreBonus || 20;
    }
  }

  // Director identifiable + contactable: 10 points
  if (context.hasDirectorContact) {
    details.directorContactable = 10;
  }

  // Company size (3-9 employees sweet spot): 10 points
  if (prospect.employeeCount !== null) {
    if (prospect.employeeCount >= 3 && prospect.employeeCount <= 9) {
      details.companySize = 10;
    } else if (prospect.employeeCount >= 1 && prospect.employeeCount <= 2) {
      details.companySize = 5;
    } else if (prospect.employeeCount >= 10 && prospect.employeeCount <= 20) {
      details.companySize = 5;
    }
  }

  // Google presence without website: 10 points
  if (prospect.hasGooglePresence && !prospect.website) {
    details.googleWithoutWebsite = 10;
  }

  details.total = Math.min(
    100,
    details.noWebsite +
      details.weakWebsite +
      details.youngCompany +
      details.highValueSector +
      details.directorContactable +
      details.companySize +
      details.googleWithoutWebsite
  );

  const priority = getPriorityFromScore(details.total);

  return { score: details.total, priority, details };
}

export function getPriorityFromScore(score: number): number {
  if (score >= 70) return 1; // Hot
  if (score >= 55) return 2; // Warm
  if (score >= 40) return 3; // À contacter
  if (score >= 25) return 4; // Low
  return 5; // Skip
}
