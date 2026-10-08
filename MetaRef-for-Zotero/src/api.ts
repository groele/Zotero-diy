import { refreshJournalInsights } from "./modules/journal-pane";
import { exportJournalDatabase, validateJournalDatabase } from "./utils/journal-database-file";
import { getJournalInsights } from "./utils/journal-insights";
import { getTextLanguage } from "./utils/str";

const utils = { getTextLanguage };

export default { utils, getJournalInsights, exportJournalDatabase, validateJournalDatabase, refreshJournalInsights };
