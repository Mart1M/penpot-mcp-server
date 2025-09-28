export class GetBoardTool {
  constructor(mcpServer) {
    this.mcpServer = mcpServer;
  }

  getDefinition() {
    return {
      name: "get_board",
      description:
        "Récupère un board Penpot et le convertit en code Tailwind CSS",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "URL complète du board Penpot (ex: https://design.penpot.app/#/workspace?team-id=...&board-id=...)",
          },
        },
        required: ["url"],
      },
    };
  }

  // Fonction récursive pour collecter un objet et ses enfants
  collectObjectAndChildren(objectId, objects) {
    const obj = objects[objectId];
    if (!obj) return null;

    const result = { ...obj };

    // Si l'objet a des enfants (shapes), les collecter récursivement
    if (obj.shapes && Array.isArray(obj.shapes)) {
      result.children = {};
      for (const childId of obj.shapes) {
        const child = this.collectObjectAndChildren(childId, objects);
        if (child) {
          result.children[childId] = child;
        }
      }
    }

    return result;
  }

  // Convertit un token appliqué en classe Tailwind avec variable CSS
  convertAppliedToken(property, tokenValue) {
    const kebabProperty = property.replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`
    );

    switch (property) {
      case "fill":
        return `bg-[var(--${tokenValue})]`;
      case "r1":
      case "r2":
      case "r3":
      case "r4":
        // Sera géré dans convertAppliedTokensRadius pour éviter les doublons
        return null;
      default:
        return `${kebabProperty}-[var(--${tokenValue})]`;
    }
  }

  // Convertit les tokens de radius appliqués en évitant les doublons
  convertAppliedTokensRadius(appliedTokens) {
    const radiusTokens = {
      r1: appliedTokens.r1,
      r2: appliedTokens.r2,
      r3: appliedTokens.r3,
      r4: appliedTokens.r4,
    };

    // Vérifier si des tokens de radius sont définis
    const definedRadiusTokens = Object.values(radiusTokens).filter(Boolean);
    if (definedRadiusTokens.length === 0) return [];

    // Si tous les radius ont le même token
    if (
      radiusTokens.r1 &&
      radiusTokens.r1 === radiusTokens.r2 &&
      radiusTokens.r2 === radiusTokens.r3 &&
      radiusTokens.r3 === radiusTokens.r4
    ) {
      return [`rounded-[var(--${radiusTokens.r1})]`];
    }

    // Sinon, générer les classes spécifiques
    const classes = [];
    if (radiusTokens.r1) classes.push(`rounded-tl-[var(--${radiusTokens.r1})]`);
    if (radiusTokens.r2) classes.push(`rounded-tr-[var(--${radiusTokens.r2})]`);
    if (radiusTokens.r3) classes.push(`rounded-br-[var(--${radiusTokens.r3})]`);
    if (radiusTokens.r4) classes.push(`rounded-bl-[var(--${radiusTokens.r4})]`);

    return classes;
  }

  // Convertit les propriétés de base en classes Tailwind
  convertBasicProperties(obj) {
    const classes = [];

    // Position absolue seulement si layoutItemAbsolute est true ou si ce n'est pas une frame
    if (obj.x !== undefined && obj.y !== undefined) {
      if (obj.type !== "frame" || obj.layoutItemAbsolute === true) {
        classes.push("absolute");
        classes.push(`left-[${obj.x}px]`);
        classes.push(`top-[${obj.y}px]`);
      }
    }

    // Dimensions (sauf si growType est auto-width)
    if (obj.growType !== "auto-width") {
      if (obj.width !== undefined) {
        classes.push(`w-[${obj.width}px]`);
      }
      if (obj.height !== undefined) {
        classes.push(`h-[${obj.height}px]`);
      }
    }

    // Rotation
    if (obj.rotation && obj.rotation !== 0) {
      classes.push(`rotate-[${obj.rotation}deg]`);
    }

    // Border radius (si pas de token appliqué)
    if (
      !obj.appliedTokens ||
      !["r1", "r2", "r3", "r4"].some((r) => obj.appliedTokens[r])
    ) {
      if (obj.r1 || obj.r2 || obj.r3 || obj.r4) {
        const r1 = obj.r1 || 0;
        const r2 = obj.r2 || 0;
        const r3 = obj.r3 || 0;
        const r4 = obj.r4 || 0;

        // Si tous les radius sont identiques
        if (r1 === r2 && r2 === r3 && r3 === r4 && r1 > 0) {
          classes.push(`rounded-[${r1}px]`);
        } else if (r1 > 0 || r2 > 0 || r3 > 0 || r4 > 0) {
          // Sinon, générer les classes spécifiques
          if (r1 > 0) classes.push(`rounded-tl-[${r1}px]`);
          if (r2 > 0) classes.push(`rounded-tr-[${r2}px]`);
          if (r3 > 0) classes.push(`rounded-br-[${r3}px]`);
          if (r4 > 0) classes.push(`rounded-bl-[${r4}px]`);
        }
      }
    }

    // Couleurs de fond (si pas de token appliqué)
    if (!obj.appliedTokens?.fill && obj.fills && obj.fills.length > 0) {
      const fill = obj.fills[0];
      if (fill.fillColor) {
        classes.push(`bg-[${fill.fillColor}]`);
        if (fill.fillOpacity !== undefined && fill.fillOpacity !== 1) {
          classes.push(`bg-opacity-[${Math.round(fill.fillOpacity * 100)}]`);
        }
      }
    }

    // Layout Flexbox
    if (obj.layout === "flex") {
      classes.push("flex");

      // Direction
      if (obj.layoutFlexDir) {
        switch (obj.layoutFlexDir) {
          case "row":
            classes.push("flex-row");
            break;
          case "column":
            classes.push("flex-col");
            break;
          case "row-reverse":
            classes.push("flex-row-reverse");
            break;
          case "column-reverse":
            classes.push("flex-col-reverse");
            break;
        }
      }

      // Justify content
      if (obj.layoutJustifyContent) {
        switch (obj.layoutJustifyContent) {
          case "start":
            classes.push("justify-start");
            break;
          case "center":
            classes.push("justify-center");
            break;
          case "end":
            classes.push("justify-end");
            break;
          case "space-between":
            classes.push("justify-between");
            break;
          case "space-around":
            classes.push("justify-around");
            break;
          case "space-evenly":
            classes.push("justify-evenly");
            break;
        }
      }

      // Align items
      if (obj.layoutAlignItems) {
        switch (obj.layoutAlignItems) {
          case "start":
            classes.push("items-start");
            break;
          case "center":
            classes.push("items-center");
            break;
          case "end":
            classes.push("items-end");
            break;
          case "stretch":
            classes.push("items-stretch");
            break;
        }
      }

      // Gap
      if (obj.layoutGap) {
        if (obj.layoutGap.columnGap > 0) {
          classes.push(`gap-x-[${obj.layoutGap.columnGap}px]`);
        }
        if (obj.layoutGap.rowGap > 0) {
          classes.push(`gap-y-[${obj.layoutGap.rowGap}px]`);
        }
        if (
          obj.layoutGap.columnGap === obj.layoutGap.rowGap &&
          obj.layoutGap.columnGap > 0
        ) {
          classes.push(`gap-[${obj.layoutGap.columnGap}px]`);
        }
      }

      // Padding
      if (obj.layoutPadding) {
        const { p1, p2, p3, p4 } = obj.layoutPadding;
        if (p1 === p2 && p2 === p3 && p3 === p4) {
          classes.push(`p-[${p1}px]`);
        } else {
          if (p1 > 0) classes.push(`pt-[${p1}px]`);
          if (p2 > 0) classes.push(`pr-[${p2}px]`);
          if (p3 > 0) classes.push(`pb-[${p3}px]`);
          if (p4 > 0) classes.push(`pl-[${p4}px]`);
        }
      }
    }

    // Texte
    if (obj.type === "text" && obj.content) {
      // Extraire les propriétés de texte du premier paragraphe
      const firstParagraph = obj.content.children?.[0]?.children?.[0];
      if (firstParagraph) {
        // Taille de police
        if (firstParagraph.fontSize) {
          classes.push(`text-[${firstParagraph.fontSize}px]`);
        }

        // Poids de police
        if (firstParagraph.fontWeight) {
          const weightMap = {
            100: "font-thin",
            200: "font-extralight",
            300: "font-light",
            400: "font-normal",
            500: "font-medium",
            600: "font-semibold",
            700: "font-bold",
            800: "font-extrabold",
            900: "font-black",
          };
          classes.push(
            weightMap[firstParagraph.fontWeight] ||
              `font-[${firstParagraph.fontWeight}]`
          );
        }

        // Alignement du texte
        if (firstParagraph.textAlign) {
          switch (firstParagraph.textAlign) {
            case "left":
              classes.push("text-left");
              break;
            case "center":
              classes.push("text-center");
              break;
            case "right":
              classes.push("text-right");
              break;
            case "justify":
              classes.push("text-justify");
              break;
          }
        }

        // Couleur du texte
        if (firstParagraph.fills && firstParagraph.fills[0]?.fillColor) {
          classes.push(`text-[${firstParagraph.fills[0].fillColor}]`);
        }

        // Hauteur de ligne
        if (firstParagraph.lineHeight) {
          classes.push(`leading-[${firstParagraph.lineHeight}]`);
        }

        // Espacement des lettres
        if (
          firstParagraph.letterSpacing &&
          firstParagraph.letterSpacing !== "0"
        ) {
          classes.push(`tracking-[${firstParagraph.letterSpacing}px]`);
        }
      }
    }

    return classes;
  }

  // Génère le code HTML avec les classes Tailwind
  generateHTML(obj, depth = 0) {
    const indent = "  ".repeat(depth);
    const classes = [];

    // Ajouter les classes des tokens appliqués (sauf radius qui sera géré séparément)
    if (obj.appliedTokens) {
      for (const [property, tokenValue] of Object.entries(obj.appliedTokens)) {
        const tokenClass = this.convertAppliedToken(property, tokenValue);
        if (tokenClass) {
          classes.push(tokenClass);
        }
      }

      // Gérer les tokens de radius séparément pour éviter les doublons
      const radiusClasses = this.convertAppliedTokensRadius(obj.appliedTokens);
      classes.push(...radiusClasses);
    }

    // Ajouter les classes des propriétés de base
    classes.push(...this.convertBasicProperties(obj));

    // Déterminer la balise HTML
    let tag = "div";
    if (obj.type === "text") {
      tag = "p";
    } else if (obj.type === "frame") {
      tag = "div";
    }

    // Construire la classe CSS
    const className = classes.join(" ");

    let html = `${indent}<${tag}`;
    if (className) {
      html += ` class="${className}"`;
    }
    html += `>`;

    // Contenu du texte
    if (obj.type === "text" && obj.content) {
      const textContent = this.extractTextContent(obj.content);
      if (textContent) {
        html += textContent;
      }
    }

    // Enfants
    if (obj.children && Object.keys(obj.children).length > 0) {
      html += "\n";
      for (const [childId, child] of Object.entries(obj.children)) {
        html += this.generateHTML(child, depth + 1);
      }
      html += `${indent}`;
    }

    html += `</${tag}>\n`;

    return html;
  }

  // Extrait le contenu textuel d'un objet content Penpot
  extractTextContent(content) {
    if (!content || !content.children) return "";

    let text = "";
    for (const child of content.children) {
      if (child.type === "paragraph-set" && child.children) {
        for (const paragraph of child.children) {
          if (paragraph.children) {
            for (const textNode of paragraph.children) {
              if (textNode.text) {
                text += textNode.text;
              }
            }
          }
        }
      }
    }
    return text;
  }

  // Convertit l'objet Penpot en code Tailwind
  convertToTailwind(penpotObject) {
    const html = this.generateHTML(penpotObject);

    // Générer aussi les informations sur les tokens utilisés
    const tokensUsed = new Set();
    if (penpotObject.appliedTokens) {
      for (const tokenValue of Object.values(penpotObject.appliedTokens)) {
        tokensUsed.add(tokenValue);
      }
    }

    // Collecter récursivement les tokens des enfants
    const collectTokens = (obj) => {
      if (obj.appliedTokens) {
        for (const tokenValue of Object.values(obj.appliedTokens)) {
          tokensUsed.add(tokenValue);
        }
      }
      if (obj.children) {
        for (const child of Object.values(obj.children)) {
          collectTokens(child);
        }
      }
    };
    collectTokens(penpotObject);

    return {
      html: html.trim(),
      json: penpotObject,
      tokensUsed: Array.from(tokensUsed),
      cssVariables: Array.from(tokensUsed)
        .map((token) => `--${token}: /* token value */;`)
        .join("\n"),
      frameName: penpotObject.name || "Frame",
    };
  }

  async handle(args) {
    const { url, accessToken } = args;

    if (!url) {
      throw new Error("URL requise");
    }

    const token = accessToken || this.mcpServer.accessToken;
    if (!token) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error:
                  "Access token requis. Utilisez configure_access_token pour le configurer.",
                instructions:
                  "Générez un access token dans Penpot (Profile > Access tokens) puis utilisez configure_access_token.",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    try {
      const params = this.mcpServer.parseUrlParams(url);

      if (!params.fileId) {
        throw new Error("file-id manquant dans l'URL");
      }

      if (!params.pageId) {
        throw new Error("page-id manquant dans l'URL");
      }

      if (!params.boardId) {
        throw new Error("board-id manquant dans l'URL");
      }

      // Utiliser board-id comme object-id pour récupérer seulement cet objet
      const pageParams = {
        "file-id": params.fileId,
        "page-id": params.pageId,
        "object-id": params.boardId,
      };

      const rawPage = await this.mcpServer.makeApiRequest(
        "get-page",
        pageParams,
        token
      );
      const pageData = this.mcpServer.convertTransitToCleanJson(rawPage);

      // Extraire l'objet board et tous ses enfants puis convertir en Tailwind
      let result = null;

      if (pageData && pageData.objects && pageData.objects[params.boardId]) {
        const boardObject = this.collectObjectAndChildren(
          params.boardId,
          pageData.objects
        );
        result = this.convertToTailwind(boardObject);
      } else if (pageData && pageData.objects) {
        result = {
          error: `Objet avec board-id ${params.boardId} non trouvé dans la page`,
        };
      } else {
        result = { error: "Aucuns objets trouvés dans la page" };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
                url: url,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }
}
