declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    EVIDENCE: R2Bucket;
    MESH_API_KEY?: string;
    MESH_API_ENDPOINT?: string;
    MESH_API_MODEL?: string;
  }
}
