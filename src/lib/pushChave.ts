/**
 * Chave pública dos avisos no celular (Web Push, padrão VAPID). É pública por natureza: o navegador
 * usa para saber que o aviso veio do CRM. A chave privada que faz par com ela fica só na variável
 * VAPID_PRIVATE_KEY (Vercel e .env.local); se trocar uma, troque as duas e todo mundo ativa de novo.
 */
export const VAPID_CHAVE_PUBLICA = 'BKVR6MfVNvO_gDI1wKmRkhBtvyoX6LGMOqCKLeyr6olvgbvoPhI44_2VN7BHhBnenPqdzyMq-AfxZwSH1RBMeYc';

export type AvisoPush = { titulo: string; corpo: string; url?: string; tag?: string };
