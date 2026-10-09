import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { emptyTwin, type Twin } from "./schema.ts";

/** JSON-file persistence. Atomic write (tmp + rename) so a crash can't corrupt the twin. */
export class TwinStore {
  twin: Twin;
  constructor(private path = "data/twin.json") {
    this.twin = existsSync(path) ? { ...emptyTwin(), ...JSON.parse(readFileSync(path, "utf8")) } : emptyTwin();
  }
  save() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path + ".tmp", JSON.stringify(this.twin, null, 2));
    renameSync(this.path + ".tmp", this.path);
  }
}
