/* Point d'entrée unique de GSAP : les plugins sont enregistrés une seule fois.
   À importer uniquement depuis des composants clients (GSAP ne s'exécute jamais côté serveur). */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

export { gsap, ScrollTrigger, SplitText, useGSAP };
