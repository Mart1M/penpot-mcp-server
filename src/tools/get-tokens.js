export class GetTokensTool {
  constructor(mcpServer) {
    this.mcpServer = mcpServer;
  }

  getDefinition() {
    return {
      name: "get_tokens",
      description:
        "Retrieves design tokens from a Penpot file and formats them according to DTCG standard",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "Complete Penpot file URL (ex: https://design.penpot.app/#/workspace?team-id=...&file-id=...)",
          },
        },
        required: ["url"],
      },
    };
  }

  // Convertit les tokens Penpot au format DTCG
  convertToDTCG(tokensLib) {
    const dtcgTokens = {};

    // Traiter chaque collection de tokens
    for (const [collectionName, tokens] of Object.entries(tokensLib)) {
      // Ignorer les métadonnées spéciales
      if (collectionName.startsWith("$")) continue;

      dtcgTokens[collectionName] = {};

      for (const [tokenName, tokenData] of Object.entries(tokens)) {
        if (typeof tokenData === "object" && tokenData.$value !== undefined) {
          const dtcgToken = {
            $value: this.convertTokenValue(tokenData.$value, tokenData.$type),
            $type: this.mapTokenType(tokenData.$type),
          };

          if (tokenData.$description) {
            dtcgToken.$description = tokenData.$description;
          }

          dtcgTokens[collectionName][tokenName] = dtcgToken;
        }
      }
    }

    // Ajouter les métadonnées si elles existent
    if (tokensLib.$themes) {
      dtcgTokens.$themes = tokensLib.$themes.map((theme) => ({
        name: theme.name,
        id: theme.id,
        description: theme.description || "",
        selectedTokenSets: theme.selectedTokenSets,
      }));
    }

    return dtcgTokens;
  }

  // Convertit la valeur du token selon son type
  convertTokenValue(value, type) {
    switch (type) {
      case "color":
        // Convertir rgb(r, g, b) en format hex si nécessaire
        if (typeof value === "string" && value.startsWith("rgb(")) {
          const rgbMatch = value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgbMatch) {
            const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
            const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
            const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
            return `#${r}${g}${b}`;
          }
        }
        return value;

      case "borderRadius":
      case "spacing":
      case "dimension":
        // Assurer que les valeurs numériques ont une unité
        if (typeof value === "string" && !isNaN(value)) {
          return `${value}px`;
        }
        return value;

      case "fontWeight":
        // Convertir les poids de police en nombres si nécessaire
        const weightMap = {
          thin: "100",
          extralight: "200",
          light: "300",
          normal: "400",
          medium: "500",
          semibold: "600",
          bold: "700",
          extrabold: "800",
          black: "900",
        };
        return weightMap[value.toLowerCase()] || value;

      default:
        return value;
    }
  }

  // Mappe les types de tokens Penpot vers DTCG
  mapTokenType(penpotType) {
    const typeMap = {
      borderRadius: "dimension",
      spacing: "dimension",
      fontFamily: "fontFamily",
      fontWeight: "fontWeight",
      fontSize: "dimension",
      lineHeight: "number",
      letterSpacing: "dimension",
      color: "color",
      shadow: "shadow",
      border: "border",
      transition: "transition",
      "cubic-bezier": "cubicBezier",
    };

    return typeMap[penpotType] || penpotType;
  }

  // Génère les variables CSS à partir des tokens actifs
  generateCSSVariables(dtcgTokens) {
    let cssVariables = ":root {\n";

    // Identifier les collections actives
    const activeSets = dtcgTokens.$metadata?.activeSets || [];

    if (activeSets.length === 0) {
      // Si aucune collection active spécifiée, utiliser la première disponible
      const collections = Object.keys(dtcgTokens).filter(
        (key) => !key.startsWith("$")
      );
      if (collections.length > 0) {
        activeSets.push(collections[0]);
      }
    }

    // Générer les variables CSS pour les collections actives
    for (const setName of activeSets) {
      if (dtcgTokens[setName]) {
        for (const [tokenName, tokenData] of Object.entries(
          dtcgTokens[setName]
        )) {
          cssVariables += `  --${tokenName}: ${tokenData.$value};\n`;
        }
      }
    }

    cssVariables += "}";
    return cssVariables;
  }

  async handle(args) {
    const { url, accessToken } = args;

    if (!url) {
      throw new Error("URL required");
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
                  "Access token required. Use configure_access_token to set it up.",
                instructions:
                  "Generate an access token in Penpot (Profile > Access tokens) then use configure_access_token.",
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
        throw new Error("file-id missing from URL");
      }

      // Appeler l'API get-file avec l'ID du fichier
      const fileParams = {
        id: params.fileId,
      };

      const rawFile = await this.mcpServer.makeApiRequest(
        "get-file",
        fileParams,
        token
      );
      const fileData = this.mcpServer.convertTransitToCleanJson(rawFile);

      // Extraire et convertir les tokens
      let result = null;

      if (fileData && fileData.data && fileData.data.tokensLib) {
        const dtcgTokens = this.convertToDTCG(fileData.data.tokensLib);
        const cssVariables = this.generateCSSVariables(dtcgTokens);

        result = {
          tokens: dtcgTokens,
          cssVariables: cssVariables,
          summary: {
            collections: Object.keys(dtcgTokens).filter(
              (key) => !key.startsWith("$")
            ).length,
            themes: dtcgTokens.$themes?.length || 0,
          },
        };
      } else {
        result = {
          error: "No tokens library found in file",
          fileData: fileData,
        };
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
