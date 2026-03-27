import type { OutputFormat, Strategy } from '../../db/index.ts';

// Re-export the WaitFor type that matches the DB/scrape schema
export type WaitFor =
  | { type: 'networkidle' }
  | { type: 'selector'; value: string }
  | { type: 'js'; value: string }
  | { type: 'delay'; value: number };

export interface ScrapePreset {
  id: string;
  name: string;
  /** Broad grouping: 'ecommerce' | 'jobs' | 'real-estate' | 'news' | 'social' | 'data' */
  category: string;
  description: string;
  /** Domains that trigger auto-detection when no preset is specified. */
  matchDomains?: string[];
  strategy: 'http' | 'playwright' | 'auto';
  waitFor?: WaitFor;
  outputFormats: OutputFormat[];
  /** ISO 4217 currency code for the market this preset targets (e.g. 'GBP', 'EUR', 'USD'). */
  currency?: string;
  /** Selector map using the all: and @attr syntax from extractors/structured.ts */
  selectors: Record<string, string>;
  /**
   * Optional post-processing step applied after raw CSS extraction.
   * Use it to clean price strings, parse numeric ratings, etc.
   */
  postProcess?: (raw: Record<string, string | string[] | null>) => Record<string, unknown>;
}

// ─── Import all preset groups ──────────────────────────────────────────────────

import {
  amazonProduct,
  ebayListing,
  etsyProduct,
  shopifyProduct,
  currysProduct,
  johnLewisProduct,
  argosProduct,
  aoProduct,
  veryProduct,
  scanProduct,
  woocommerceProduct,
  overclockerProduct,
  boxProduct,
  laptopsDirectProduct,
  ebuyerProduct,
  // US retailers
  bestBuyProduct,
  walmartProduct,
  neweggProduct,
  adoramaProduct,
  targetUsProduct,
  // AU retailers
  jbHifiAuProduct,
  harveyNormanAuProduct,
  theGoodGuysProduct,
  // DE retailers
  mediamarktDeProduct,
  saturnDeProduct,
  notebooksbilligerDeProduct,
  cyberportDeProduct,
  alternateDeProduct,
  // FR retailers
  fnacFrProduct,
  dartyFrProduct,
  boulangerFrProduct,
  // NL retailers
  bolComProduct,
  coolblueNlProduct,
  // ES retailers
  pcComponentesProduct,
  elCorteInglesProduct,
  amazonEsProduct,
  mediaMarktEsProduct,
  // IT retailers
  unieuroItProduct,
  mediaworldItProduct,
  amazonItProduct,
  // IN retailers
  flipkartProduct,
  amazonInProduct,
  cromaProduct,
  // JP retailers
  amazonJpProduct,
  yodobashiProduct,
  bicCameraProduct,
  // CA retailers
  memoryExpressProduct,
  mikesComputerShopProduct,
  // Category listing presets
  amazonUkCategory,
  currysCategory,
  argosCategory,
  johnLewisCategory,
  aoCategory,
  ebuyerCategory,
  scanCategory,
  laptopsDirectCategory,
  veryCategory,
  // UK Fashion
  asosProduct,
  nextProduct,
  marksAndSpencerProduct,
  zalandoUkProduct,
  // UK Home & Garden
  dunelmProduct,
  wayfairUkProduct,
  bAndQProduct,
  ikeaUkProduct,
  // UK Health & Beauty
  bootsProduct,
  superdrugProduct,
  lookfantasticProduct,
  // UK Sports
  sportsDirectProduct,
  jdSportsProduct,
  decathlonUkProduct,
  // UK Toys & Books
  smythsToysProduct,
  waterstonesBooksProduct,
  // UK Pets
  petsAtHomeProduct,
  // Category listings — fashion, beauty, sports, toys, books, pets, home
  asosCategory,
  nextCategory,
  marksAndSpencerCategory,
  zalandoUkCategory,
  bootsCategory,
  superdrugCategory,
  lookfantasticCategory,
  sportsDirectCategory,
  jdSportsCategory,
  decathlonUkCategory,
  smythsCategory,
  waterstonesCategory,
  petsAtHomeCategory,
  dunelmCategory,
  wayfairUkCategory,
  bAndQCategory,
  // UK tech/electronics category presets
  overclockersCategoryUk,
  boxCategory,
  cclComputersCategory,
  novatechCategory,
  backMarketCategory,
  musicMagpieCategory,
  richerSoundsCategory,
  gameUkCategory,
  shoptoCategory,
  zavviCategory,
  gamesCategory,
  halfordsCategory,
  appliancesDirectCategory,
  lakelandCategory,
  // UK fashion category presets
  boohooCategory,
  prettylittlethingCategory,
  newLookCategory,
  riverIslandCategory,
  houseOfFraserCategory,
  flannelsCategory,
  mainlineMenswearCategory,
  fatFaceCategory,
  whiteStuffCategory,
  joulesCategory,
  tedBakerCategory,
  reissCategory,
  superdryCategory,
  matalanCategory,
  quizCategory,
  georgeAsdaCategory,
  // UK sports/outdoor category presets
  goOutdoorsCategory,
  mountainWarehouseCategory,
  cotswoldOutdoorCategory,
  chainReactionCategory,
  sweatyBettyCategory,
  lululemonUkCategory,
  // UK beauty category presets (additional)
  beautyBayCategory,
  spaceNkCategory,
  theBodyShopCategory,
  hollandBarrettCategory,
  fragranceDirectCategory,
  // UK toys category presets (additional)
  theEntertainerCategory,
  hamleysCategory,
  // UK books category presets
  whsmithCategory,
  theBookPeopleCategory,
  hiveCategory,
  blackwellsCategory,
  // UK pets category presets (additional)
  zooplusCategory,
  jollyesCategory,
  viovetCategory,
  // UK home/garden additional category presets
  homebaseCategory,
  oakFurniturelandCategory,
  coxAndCoxCategory,
  gardenTradingCategory,
  // UK product presets — Group 1: Tech / Gaming
  backMarketProduct,
  musicMagpieProduct,
  richerSoundsProduct,
  gameUkProduct,
  shoptoProduct,
  zavviProduct,
  games365Product,
  halfordsProduct,
  appliancesDirectProduct,
  lakelandProduct,
  novatechProduct,
  cclComputersProduct,
  highStreetTvProduct,
  bedsCoUkProduct,
  // UK product presets — Group 2: Fashion
  boohooProduct,
  prettylittlethingProduct,
  newLookProduct,
  riverIslandProduct,
  houseOfFraserProduct,
  flannelsProduct,
  mainlineMenswearProduct,
  fatFaceProduct,
  whiteStuffProduct,
  joulesProduct,
  tedBakerProduct,
  reissProduct,
  superdryProduct,
  matalanProduct,
  quizProduct,
  georgeAsdaProduct,
  debenhamsProduct,
  karenMillenProduct,
  dorothyPerkinsProduct,
  wallisProduct,
  missSelfridgeProduct,
  // UK product presets — Group 3: Sports & Outdoor
  goOutdoorsProduct,
  mountainWarehouseProduct,
  cotswoldOutdoorProduct,
  chainReactionProduct,
  sweatyBettyProduct,
  lululemonUkProduct,
  blacksProduct,
  evansCyclesProduct,
  probikeKitProduct,
  underArmourUkProduct,
  // UK product presets — Group 4: Beauty & Health
  beautyBayProduct,
  spaceNkProduct,
  theBodyShopProduct,
  hollandBarrettProduct,
  fragranceDirectProduct,
  feeluniqueProduct,
  chemistDirectProduct,
  pharmacy2uProduct,
  // UK product presets — Group 5: Toys
  theEntertainerProduct,
  hamleysProduct,
  characterOnlineProduct,
  // UK product presets — Group 6: Books
  whsmithProduct,
  theBookPeopleProduct,
  hiveProduct,
  blackwellsProduct,
  // UK product presets — Group 7: Pets
  zooplusProduct,
  jollyesProduct,
  viovetProduct,
  monsterPetProduct,
  // UK product presets — Group 8: Home
  homebaseProduct,
  oakFurniturelandProduct,
  coxAndCoxProduct,
  gardenTradingProduct,
  wickesProduct,
  furnitureBoxProduct,
  furnitureVillageProduct,
  laRedouteUkProduct,
  jewelleryBoxProduct,
  jessopsCategory,
  jessopsProduct,
  hughesDirect,
  ninjaKitchenUk,
} from './ecommerce.ts';
import { indeedJob, linkedinJob, glassdoorJob, remoteokListing } from './jobs.ts';
import { rightmoveProperty, zillowListing, zooplaProperty } from './realestate.ts';
import { genericArticle, hnPost, redditPost } from './news.ts';
import { googleSerp, yellowPages, tripadvisorHotel, trustpilotCompany } from './data.ts';
import { twitterProfile, youtubeVideo } from './social.ts';

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PRESETS: Record<string, ScrapePreset> = {
  // ecommerce — global
  'amazon-product':    amazonProduct,
  'ebay-listing':      ebayListing,
  'etsy-product':      etsyProduct,
  'shopify-product':   shopifyProduct,

  // ecommerce — UK retailers
  'currys-product':        currysProduct,
  'johnlewis-product':     johnLewisProduct,
  'argos-product':         argosProduct,
  'ao-product':            aoProduct,
  'very-product':          veryProduct,
  'scan-product':          scanProduct,
  'woocommerce-product':   woocommerceProduct,
  'overclockers-product':  overclockerProduct,
  'box-product':           boxProduct,
  'laptopsdirect-product': laptopsDirectProduct,
  'ebuyer-product':        ebuyerProduct,

  // ecommerce — US retailers
  'best-buy':    bestBuyProduct,
  'walmart':     walmartProduct,
  'newegg':      neweggProduct,
  'adorama':     adoramaProduct,
  'target-us':   targetUsProduct,

  // ecommerce — AU retailers
  'jb-hifi-au':          jbHifiAuProduct,
  'harvey-norman-au':    harveyNormanAuProduct,
  'the-good-guys':       theGoodGuysProduct,

  // ecommerce — DE retailers
  'mediamarkt-de':          mediamarktDeProduct,
  'saturn-de':              saturnDeProduct,
  'notebooksbilliger-de':   notebooksbilligerDeProduct,
  'cyberport-de':           cyberportDeProduct,
  'alternate-de':           alternateDeProduct,

  // ecommerce — FR retailers
  'fnac-fr':       fnacFrProduct,
  'darty-fr':      dartyFrProduct,
  'boulanger-fr':  boulangerFrProduct,

  // ecommerce — NL retailers
  'bol-com':       bolComProduct,
  'coolblue-nl':   coolblueNlProduct,

  // ecommerce — ES retailers
  'pc-componentes':   pcComponentesProduct,
  'el-corte-ingles':  elCorteInglesProduct,
  'amazon-es':        amazonEsProduct,
  'media-markt-es':   mediaMarktEsProduct,

  // ecommerce — IT retailers
  'unieuro-it':    unieuroItProduct,
  'mediaworld-it': mediaworldItProduct,
  'amazon-it':     amazonItProduct,

  // ecommerce — IN retailers
  'flipkart':   flipkartProduct,
  'amazon-in':  amazonInProduct,
  'croma':      cromaProduct,

  // ecommerce — JP retailers
  'amazon-jp':   amazonJpProduct,
  'yodobashi':   yodobashiProduct,
  'bic-camera':  bicCameraProduct,

  // ecommerce — CA retailers
  'memory-express':       memoryExpressProduct,
  'mikes-computer-shop':  mikesComputerShopProduct,

  // ecommerce — UK fashion
  'asos-product':               asosProduct,
  'next-product':               nextProduct,
  'marks-and-spencer-product':  marksAndSpencerProduct,
  'zalando-uk-product':         zalandoUkProduct,

  // ecommerce — UK home & garden
  'dunelm-product':      dunelmProduct,
  'wayfair-uk-product':  wayfairUkProduct,
  'b-and-q-product':     bAndQProduct,
  'ikea-uk-product':     ikeaUkProduct,

  // ecommerce — UK health & beauty
  'boots-product':         bootsProduct,
  'superdrug-product':     superdrugProduct,
  'lookfantastic-product': lookfantasticProduct,

  // ecommerce — UK sports
  'sports-direct-product':  sportsDirectProduct,
  'jd-sports-product':      jdSportsProduct,
  'decathlon-uk-product':   decathlonUkProduct,

  // ecommerce — UK toys & books
  'smyths-toys-product':     smythsToysProduct,
  'waterstones-product':     waterstonesBooksProduct,

  // ecommerce — UK pets
  'pets-at-home-product':   petsAtHomeProduct,

  // ecommerce — category/listing pages
  'amazon-uk-category':    amazonUkCategory,
  'currys-category':       currysCategory,
  'argos-category':        argosCategory,
  'johnlewis-category':    johnLewisCategory,
  'ao-category':           aoCategory,
  'ebuyer-category':       ebuyerCategory,
  'scan-category':         scanCategory,
  'laptopsdirect-category': laptopsDirectCategory,
  'very-category':         veryCategory,

  // ecommerce — UK fashion category pages
  'asos-category':               asosCategory,
  'next-category':               nextCategory,
  'marks-and-spencer-category':  marksAndSpencerCategory,
  'zalando-uk-category':         zalandoUkCategory,

  // ecommerce — UK beauty category pages
  'boots-category':         bootsCategory,
  'superdrug-category':     superdrugCategory,
  'lookfantastic-category': lookfantasticCategory,

  // ecommerce — UK sports category pages
  'sports-direct-category':  sportsDirectCategory,
  'jd-sports-category':      jdSportsCategory,
  'decathlon-uk-category':   decathlonUkCategory,

  // ecommerce — UK toys/books/pets category pages
  'smyths-category':        smythsCategory,
  'waterstones-category':   waterstonesCategory,
  'pets-at-home-category':  petsAtHomeCategory,

  // ecommerce — UK home category pages
  'dunelm-category':      dunelmCategory,
  'wayfair-uk-category':  wayfairUkCategory,
  'b-and-q-category':     bAndQCategory,

  // ecommerce — UK tech/electronics category pages
  'overclockers-category':      overclockersCategoryUk,
  'box-category':               boxCategory,
  'ccl-computers-category':     cclComputersCategory,
  'novatech-category':          novatechCategory,
  'back-market-category':       backMarketCategory,
  'music-magpie-category':      musicMagpieCategory,
  'richer-sounds-category':     richerSoundsCategory,
  'game-uk-category':           gameUkCategory,
  'shopto-category':            shoptoCategory,
  'zavvi-category':             zavviCategory,
  '365games-category':          gamesCategory,
  'halfords-category':          halfordsCategory,
  'appliances-direct-category': appliancesDirectCategory,
  'lakeland-category':          lakelandCategory,

  // ecommerce — UK fashion category pages
  'boohoo-category':            boohooCategory,
  'prettylittlething-category': prettylittlethingCategory,
  'new-look-category':          newLookCategory,
  'river-island-category':      riverIslandCategory,
  'house-of-fraser-category':   houseOfFraserCategory,
  'flannels-category':          flannelsCategory,
  'mainline-menswear-category': mainlineMenswearCategory,
  'fat-face-category':          fatFaceCategory,
  'white-stuff-category':       whiteStuffCategory,
  'joules-category':            joulesCategory,
  'ted-baker-category':         tedBakerCategory,
  'reiss-category':             reissCategory,
  'superdry-category':          superdryCategory,
  'matalan-category':           matalanCategory,
  'quiz-category':              quizCategory,
  'george-asda-category':       georgeAsdaCategory,

  // ecommerce — UK sports/outdoor category pages
  'go-outdoors-category':        goOutdoorsCategory,
  'mountain-warehouse-category': mountainWarehouseCategory,
  'cotswold-outdoor-category':   cotswoldOutdoorCategory,
  'chain-reaction-category':     chainReactionCategory,
  'sweaty-betty-category':       sweatyBettyCategory,
  'lululemon-uk-category':       lululemonUkCategory,

  // ecommerce — UK beauty category pages (additional)
  'beauty-bay-category':         beautyBayCategory,
  'space-nk-category':           spaceNkCategory,
  'the-body-shop-category':      theBodyShopCategory,
  'holland-barrett-category':    hollandBarrettCategory,
  'fragrance-direct-category':   fragranceDirectCategory,

  // ecommerce — UK toys category pages (additional)
  'the-entertainer-category':    theEntertainerCategory,
  'hamleys-category':            hamleysCategory,

  // ecommerce — UK books category pages
  'whsmith-category':            whsmithCategory,
  'the-book-people-category':    theBookPeopleCategory,
  'hive-category':               hiveCategory,
  'blackwells-category':         blackwellsCategory,

  // ecommerce — UK pets category pages (additional)
  'zooplus-category':            zooplusCategory,
  'jollyes-category':            jollyesCategory,
  'viovet-category':             viovetCategory,

  // ecommerce — UK home/garden additional category pages
  'homebase-category':           homebaseCategory,
  'oak-furnitureland-category':  oakFurniturelandCategory,
  'cox-and-cox-category':        coxAndCoxCategory,
  'garden-trading-category':     gardenTradingCategory,

  // ecommerce — UK product presets: Tech / Gaming
  'back-market-product':        backMarketProduct,
  'music-magpie-product':       musicMagpieProduct,
  'richer-sounds-product':      richerSoundsProduct,
  'game-uk-product':            gameUkProduct,
  'shopto-product':             shoptoProduct,
  'zavvi-product':              zavviProduct,
  '365games-product':           games365Product,
  'halfords-product':           halfordsProduct,
  'appliances-direct-product':  appliancesDirectProduct,
  'lakeland-product':           lakelandProduct,
  'novatech-product':           novatechProduct,
  'ccl-computers-product':      cclComputersProduct,
  'high-street-tv-product':     highStreetTvProduct,
  'beds-co-uk-product':         bedsCoUkProduct,

  // ecommerce — UK product presets: Fashion
  'boohoo-product':              boohooProduct,
  'prettylittlething-product':   prettylittlethingProduct,
  'new-look-product':            newLookProduct,
  'river-island-product':        riverIslandProduct,
  'house-of-fraser-product':     houseOfFraserProduct,
  'flannels-product':            flannelsProduct,
  'mainline-menswear-product':   mainlineMenswearProduct,
  'fat-face-product':            fatFaceProduct,
  'white-stuff-product':         whiteStuffProduct,
  'joules-product':              joulesProduct,
  'ted-baker-product':           tedBakerProduct,
  'reiss-product':               reissProduct,
  'superdry-product':            superdryProduct,
  'matalan-product':             matalanProduct,
  'quiz-product':                quizProduct,
  'george-asda-product':         georgeAsdaProduct,
  'debenhams-product':           debenhamsProduct,
  'karen-millen-product':        karenMillenProduct,
  'dorothy-perkins-product':     dorothyPerkinsProduct,
  'wallis-product':              wallisProduct,
  'miss-selfridge-product':      missSelfridgeProduct,

  // ecommerce — UK product presets: Sports & Outdoor
  'go-outdoors-product':         goOutdoorsProduct,
  'mountain-warehouse-product':  mountainWarehouseProduct,
  'cotswold-outdoor-product':    cotswoldOutdoorProduct,
  'chain-reaction-product':      chainReactionProduct,
  'sweaty-betty-product':        sweatyBettyProduct,
  'lululemon-uk-product':        lululemonUkProduct,
  'blacks-product':              blacksProduct,
  'evans-cycles-product':        evansCyclesProduct,
  'probikekit-product':          probikeKitProduct,
  'under-armour-uk-product':     underArmourUkProduct,

  // ecommerce — UK product presets: Beauty & Health
  'beauty-bay-product':          beautyBayProduct,
  'space-nk-product':            spaceNkProduct,
  'the-body-shop-product':       theBodyShopProduct,
  'holland-barrett-product':     hollandBarrettProduct,
  'fragrance-direct-product':    fragranceDirectProduct,
  'feelunique-product':          feeluniqueProduct,
  'chemist-direct-product':      chemistDirectProduct,
  'pharmacy2u-product':          pharmacy2uProduct,

  // ecommerce — UK product presets: Toys
  'the-entertainer-product':     theEntertainerProduct,
  'hamleys-product':             hamleysProduct,
  'character-online-product':    characterOnlineProduct,

  // ecommerce — UK product presets: Books
  'whsmith-product':             whsmithProduct,
  'the-book-people-product':     theBookPeopleProduct,
  'hive-product':                hiveProduct,
  'blackwells-product':          blackwellsProduct,

  // ecommerce — UK product presets: Pets
  'zooplus-product':             zooplusProduct,
  'jollyes-product':             jollyesProduct,
  'viovet-product':              viovetProduct,
  'monster-pet-product':         monsterPetProduct,

  // ecommerce — UK product presets: Home
  'homebase-product':            homebaseProduct,
  'oak-furnitureland-product':   oakFurniturelandProduct,
  'cox-and-cox-product':         coxAndCoxProduct,
  'garden-trading-product':      gardenTradingProduct,
  'wickes-product':              wickesProduct,
  'furniture-box-product':       furnitureBoxProduct,
  'furniture-village-product':   furnitureVillageProduct,
  'la-redoute-uk-product':       laRedouteUkProduct,
  'jewellery-box-product':       jewelleryBoxProduct,
  'jessops-category':            jessopsCategory,
  'jessops-product':             jessopsProduct,
  'hughes-direct':               hughesDirect,
  'ninja-kitchen-uk':            ninjaKitchenUk,

  // jobs
  'indeed-job':        indeedJob,
  'linkedin-job':      linkedinJob,
  'glassdoor-job':     glassdoorJob,
  'remoteok-listing':  remoteokListing,

  // real-estate
  'rightmove-property': rightmoveProperty,
  'zillow-listing':     zillowListing,
  'zoopla-property':    zooplaProperty,

  // news
  'article':           genericArticle,
  'hn-post':           hnPost,
  'reddit-post':       redditPost,

  // data aggregators / directories
  'google-serp':         googleSerp,
  'yellow-pages':        yellowPages,
  'tripadvisor-hotel':   tripadvisorHotel,
  'trustpilot-company':  trustpilotCompany,

  // social
  'twitter-profile': twitterProfile,
  'youtube-video':   youtubeVideo,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auto-detect a preset from a URL by matching against each preset's matchDomains.
 * Returns the first match, or null if none found.
 */
export function detectPreset(url: string): ScrapePreset | null {
  for (const preset of Object.values(PRESETS)) {
    if (preset.matchDomains?.some(d => url.includes(d))) return preset;
  }
  return null;
}

/** Return a lightweight summary of all presets, suitable for a discovery endpoint. */
export function listPresets(): Array<{
  id: string;
  name: string;
  category: string;
  description: string;
  matchDomains?: string[];
}> {
  return Object.values(PRESETS).map(({ id, name, category, description, matchDomains }) => ({
    id, name, category, description, matchDomains,
  }));
}
