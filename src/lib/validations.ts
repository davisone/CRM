import { z } from "zod";

export const createProspectSchema = z.object({
  siren: z.string().length(9, "Le SIREN doit contenir 9 chiffres"),
  companyName: z.string().min(1, "Raison sociale requise"),
  siret: z.string().optional(),
  legalForm: z.string().optional(),
  nafCode: z.string().optional(),
  nafLabel: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  employeeCount: z.number().int().min(0).optional(),
});

export const updateProspectSchema = createProspectSchema.partial().extend({
  status: z
    .enum([
      "NOUVEAU",
      "A_CONTACTER",
      "CONTACTE",
      "INTERESSE",
      "A_RELANCER",
      "CLIENT",
      "NON_INTERESSE",
      "PERDU",
      "NE_PLUS_CONTACTER",
    ])
    .optional(),
  assignedToId: z.string().optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  followUpNote: z.string().optional().nullable(),
});

export const createActivitySchema = z.object({
  type: z.enum(["APPEL", "EMAIL", "NOTE", "RELANCE", "CHANGEMENT_STATUT"]),
  title: z.string().min(1, "Titre requis"),
  content: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const statusTransitionSchema = z.object({
  status: z.enum([
    "NOUVEAU",
    "A_CONTACTER",
    "CONTACTE",
    "INTERESSE",
    "A_RELANCER",
    "CLIENT",
    "NON_INTERESSE",
    "PERDU",
    "NE_PLUS_CONTACTER",
  ]),
  reason: z.string().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  name: z.string().min(1, "Nom requis"),
  password: z.string().min(6, "6 caractères minimum"),
  role: z.enum(["ADMIN", "COMMERCIAL", "TELEPROSPECTEUR"]),
  maxProspects: z.number().int().min(1).default(100),
});
