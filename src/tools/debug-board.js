export class DebugBoardTool {
  constructor(mcpServer) {
    this.mcpServer = mcpServer;
  }

  getDefinition() {
    return {
      name: "debug_board",
      description:
        "Récupère un board Penpot et affiche le JSON brut pour debug",
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

      // Extraire l'objet board et tous ses enfants pour debug
      let result = null;

      if (pageData && pageData.objects && pageData.objects[params.boardId]) {
        const boardObject = this.collectObjectAndChildren(
          params.boardId,
          pageData.objects
        );
        result = {
          debug: true,
          boardObject: boardObject,
          allObjects: pageData.objects,
          params: params,
        };
      } else if (pageData && pageData.objects) {
        result = {
          debug: true,
          error: `Objet avec board-id ${params.boardId} non trouvé dans la page`,
          allObjects: pageData.objects,
          params: params,
        };
      } else {
        result = {
          debug: true,
          error: "Aucuns objets trouvés dans la page",
          rawResponse: pageData,
          params: params,
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
                debug: true,
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
