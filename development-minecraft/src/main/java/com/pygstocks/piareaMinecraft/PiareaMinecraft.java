package com.pygstocks.piareaMinecraft;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.WorldBorder;
import org.bukkit.boss.BarColor;
import org.bukkit.boss.BarStyle;
import org.bukkit.boss.BossBar;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerPickupItemEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.ScoreboardManager;
import org.jetbrains.annotations.NotNull;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
public class PiareaMinecraft extends JavaPlugin implements Listener {
    private static final long HOLDINGS_TTL_MS = 60_000L;
    private static final long SCOREBOARD_INTERVAL_TICKS = 5L * 20L;
    private static final long BOSSBAR_INTERVAL_TICKS = 10L * 20L;
    private static final Component REWARD_TITLE = Component.text("[PIAREA] 보상 메뉴", NamedTextColor.WHITE);
    private static final Component MAIN_GUI_TITLE = Component.text("[PIAREA] 메뉴", NamedTextColor.WHITE);
    private static final Component COINS_GUI_TITLE = Component.text("[PIAREA] 코인 메뉴", NamedTextColor.WHITE);
    private static final Component STOCKS_KR_GUI_TITLE = Component.text("[PIAREA] 국내 주식 메뉴", NamedTextColor.WHITE);
    private static final Component STOCKS_US_GUI_TITLE = Component.text("[PIAREA] 미국 주식 메뉴", NamedTextColor.WHITE);
    private static final String[] COIN_SYMBOLS = {
            "BTC", "ETH", "USDT", "XRP", "BNB", "SOL", "USDC", "TRX", "DOGE", "ADA",
            "HLP", "BCH", "LINK", "LEO", "XLM", "ZEC", "XMR", "USDE", "LTC", "AVAX"
    };
    private static final String[] KRX_SYMBOLS = {
            "S005930", "S000660", "S373220", "S207940", "S005380", "S034020", "S105560", "S329180",
            "S000270", "S012450", "S068270", "S402340", "S035420", "S028260", "S055550", "S015760",
            "S042660", "S032830", "S009540", "S196170", "S012330", "S267260", "S003550", "S035720",
            "S086790", "S010130", "S005490", "S006400", "S000810", "S010140"
    };
    private static final String[] US_SYMBOLS = {
            "NVDA", "AAPL", "GOOGL", "MSFT", "AMZN", "AVGO", "META", "TSLA", "BRKB", "LLY",
            "WMT", "JPM", "V", "ORCL", "JNJ", "MA", "XOM", "NFLX", "COST", "ABBV",
            "PLTR", "BAC", "HD", "AMD", "PG", "KO", "GE", "CVX", "CSCO", "UNH"
    };
    private final ObjectMapper om = new ObjectMapper();
    private final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private final Map<UUID, Account> accounts = new ConcurrentHashMap<>();
    private final Set<UUID> lockedNotice = ConcurrentHashMap.newKeySet();
    private final Map<UUID, List<Holding>> holdingsCache = new ConcurrentHashMap<>();
    private final Map<UUID, Long> holdingsUpdatedAt = new ConcurrentHashMap<>();
    private final Map<String, Account> linkRecords = new ConcurrentHashMap<>();
    private final Map<UUID, Double> pnlRateByPlayer = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> pnlRankByPlayer = new ConcurrentHashMap<>();
    private final String[] bossBarMessages = new String[]{
            ChatColor.WHITE + "[PIAREA] 시즌 종료 후 상위 10% 유저에게 상금 지급!!",
            ChatColor.WHITE + "[PIAREA] 약탈 O | 종목 추천 O | 훈수 O!!"
    };
    private String baseUrl;
    private double spawnRadius;
    private Location spawnCenter;
    private OkHttpClient http;
    private File linkFile;
    private BossBar bossBar;
    private NamespacedKey assetKey;
    private int bossBarIndex = 0;
    private record Account(String id, String password) {}
    private record Capitals(double cashKrw, double phantomPia) {}
    private record Holding(String symbol, String name, double units, Double pnlRate) {}
    private record Ranking(int rank, double profitRate) {}
    @Override
    public void onEnable() {
        saveDefaultConfig();
        ensureConfig();
        initLinkFile();
        http = buildHttp();
        assetKey = new NamespacedKey(this, "asset_symbol");
        initSpawn();
        initWorldBorder();
        getServer().getPluginManager().registerEvents(this, this);
        startScoreboardTask();
        initBossBar();
        getLogger().info("[PIAREA] 마인크래프트 플러그인이 준비되었습니다!!");
    }
    private void ensureConfig() {
        File f = new File(getDataFolder(), "config.yml");
        if (!f.exists()) saveDefaultConfig();
        FileConfiguration c = getConfig();
        baseUrl = c.getString("piarea.baseUrl", "").trim();
        spawnRadius = Math.max(10.0, c.getDouble("piarea.spawnRadius", 50.0));
    }
    private void initSpawn() {
        World w = Bukkit.getWorlds().isEmpty() ? null : Bukkit.getWorlds().get(0);
        if (w == null) return;
        int x = 0;
        int z = 0;
        int y = w.getHighestBlockYAt(x, z) + 1;
        spawnCenter = new Location(w, x + 0.5, y, z + 0.5);
        w.setSpawnLocation(spawnCenter);
    }
    private void initWorldBorder() {
        World w = Bukkit.getWorlds().isEmpty() ? null : Bukkit.getWorlds().get(0);
        if (w == null) return;
        WorldBorder border = w.getWorldBorder();
        border.setCenter(0.5, 0.5);
        border.setSize(10000.0);
    }
    private void initLinkFile() {
        if (!getDataFolder().exists()) getDataFolder().mkdirs();
        linkFile = new File(getDataFolder(), "piarea.txt");
        loadLinkRecords();
    }
    private void loadLinkRecords() {
        linkRecords.clear();
        if (linkFile == null || !linkFile.exists()) return;
        try (BufferedReader br = new BufferedReader(new FileReader(linkFile))) {
            String line;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                int idx = line.indexOf(':');
                if (idx <= 0) continue;
                String mc = line.substring(0, idx).trim();
                String rest = line.substring(idx + 1).trim();
                if (rest.isEmpty()) continue;
                String[] parts = rest.split("\\s+", 2);
                if (parts.length < 2) continue;
                String id = parts[0];
                String pw = parts[1];
                linkRecords.put(mc, new Account(id, pw));
            }
        } catch (IOException e) {
            getLogger().warning("[PIAREA] 연동 기록을 불러오는 데 실패했습니다... " + e.getMessage());
        }
    }
    private synchronized void appendLinkRecord(String mcName, Account acc) {
        if (linkFile == null) return;
        try (FileWriter fw = new FileWriter(linkFile, true)) {
            fw.write(mcName + ": " + acc.id() + " " + acc.password() + System.lineSeparator());
        } catch (IOException e) {
            getLogger().warning("[PIAREA] 연동 기록을 저장하는 데 실패했습니다... " + e.getMessage());
        }
    }
    private Location randomSpawn(World w) {
        if (w == null || spawnCenter == null) return null;
        double r = Math.max(1.0, spawnRadius);
        double minX = spawnCenter.getX() - r;
        double minZ = spawnCenter.getZ() - r;
        double x = minX + (Math.random() * (r * 2.0));
        double z = minZ + (Math.random() * (r * 2.0));
        int bx = (int) Math.floor(x);
        int bz = (int) Math.floor(z);
        int y = w.getHighestBlockYAt(bx, bz) + 1;
        return new Location(w, bx + 0.5, y, bz + 0.5);
    }
    private OkHttpClient buildHttp() {
        CookieManager cm = new CookieManager();
        cm.setCookiePolicy(CookiePolicy.ACCEPT_ALL);
        return new OkHttpClient.Builder()
                .cookieJar(new JavaNetCookieJar(cm))
                .connectTimeout(Duration.ofSeconds(8))
                .readTimeout(Duration.ofSeconds(15))
                .build();
    }
    private String buildUrl(String path) {
        String base = baseUrl == null ? "" : baseUrl.trim();
        String p = path == null ? "" : path.trim();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        if (base.endsWith("/v1") && p.startsWith("/v1/")) p = p.substring(3);
        return base + p;
    }
    private Request.Builder req(String path) {
        return new Request.Builder()
                .url(buildUrl(path))
                .header("User-Agent", "PiareaMinecraft/1.0");
    }
    private String idem() {
        return UUID.randomUUID().toString().replace("-", "");
    }
    private JsonNode postJson(String path, JsonNode body, boolean needIdem) throws IOException {
        RequestBody rb = RequestBody.create(om.writeValueAsString(body), JSON);
        Request.Builder b = req(path).post(rb);
        if (needIdem) b.header("Idempotency-Key", idem());
        try (Response resp = http.newCall(b.build()).execute()) {
            if (!resp.isSuccessful()) {
                throw new IOException("[PIAREA] HTTP " + resp.code() + " 응답에서 오류가 발생했습니다... " + safeBody(resp));
            }
            return om.readTree(Objects.requireNonNull(resp.body()).string());
        }
    }
    private JsonNode getJson(String path) throws IOException {
        Request.Builder b = req(path).get();
        try (Response resp = http.newCall(b.build()).execute()) {
            if (!resp.isSuccessful()) {
                throw new IOException("[PIAREA] HTTP " + resp.code() + " 응답에서 오류가 발생했습니다... " + safeBody(resp));
            }
            return om.readTree(Objects.requireNonNull(resp.body()).string());
        }
    }
    private String safeBody(Response r) {
        try {
            return r.body() != null ? r.body().string() : "";
        } catch (Exception e) {
            return "";
        }
    }
    private Capitals fetchCapitals(Account acc) throws IOException {
        JsonNode in = om.createObjectNode()
                .put("id", acc.id())
                .put("password", acc.password());
        JsonNode root = postJson("/v1/portfolio/summary", in, false);
        JsonNode j = root.path("data");
        if (j.isMissingNode() || j.isNull()) j = root;
        double cash = j.path("cash_pia")
                .asDouble(j.path("cashPia")
                        .asDouble(j.path("cash_krw")
                                .asDouble(j.path("cashKrw").asDouble(0.0))));
        return new Capitals(cash, 0.0);
    }
    private List<Holding> fetchHoldings(Account acc) throws IOException {
        JsonNode in = om.createObjectNode()
                .put("id", acc.id())
                .put("password", acc.password())
                .put("includePrices", true);
        JsonNode root = postJson("/v1/assets/holdings", in, false);
        JsonNode j = root.path("data");
        if (j.isMissingNode() || j.isNull()) j = root;
        JsonNode arr = j.path("items");
        if (!arr.isArray() && j.isArray()) arr = j;
        List<Holding> out = new ArrayList<>();
        if (arr.isArray()) {
            for (JsonNode n : arr) {
                String symbol = n.path("symbol").asText("").trim();
                String name = n.path("name").asText("").trim();
                double units = n.path("qty").asDouble(Double.NaN);
                if (Double.isNaN(units)) units = n.path("units").asDouble(0.0);
                Double pnlRate = null;
                JsonNode pr = n.get("pnlRate");
                if (pr == null || pr.isNull()) pr = n.get("pnl_rate");
                if (pr != null && !pr.isNull() && pr.isNumber()) pnlRate = pr.asDouble();
                if (!symbol.isEmpty() && units != 0.0) out.add(new Holding(symbol, name, units, pnlRate));
            }
        }
        getLogger().info("[PIAREA] 보유 자산 조회가 완료되었습니다!!");
        return out;
    }
    private Map<String, Ranking> fetchUserRankings() throws IOException {
        JsonNode root = getJson("/v1/users/rankings?limit=1000");
        JsonNode j = root.path("data");
        if (j.isMissingNode() || j.isNull()) j = root;
        JsonNode arr = j.path("topByProfitRate");
        if (!arr.isArray() && j.isArray()) arr = j;
        Map<String, Ranking> out = new HashMap<>();
        if (arr.isArray()) {
            for (JsonNode n : arr) {
                String id = n.path("id").asText("").trim();
                int rank = n.path("rank").asInt(0);
                double pr = n.path("profitRate").asDouble(n.path("profit_rate").asDouble(0.0));
                if (!id.isEmpty() && rank > 0) out.put(id, new Ranking(rank, pr));
            }
        }
        return out;
    }
    private boolean postReward(Account acc, double delta) {
        try {
            double normalized = Math.round(delta * 100.0) / 100.0;
            JsonNode body = om.createObjectNode()
                    .put("id", acc.id())
                    .put("password", acc.password())
                    .put("amountPia", normalized)
                    .put("amount_pia", normalized)
                    .put("amountKrw", normalized)
                    .put("amount_krw", normalized);
            JsonNode res = postJson("/v1/rewards", body, true);
            boolean ok = res.path("ok").asBoolean(false);
            if (!ok) {
                getLogger().warning("[PIAREA] 보상 지급에 실패했습니다... delta=" + normalized +
                        " code=" + res.path("code").asText("") +
                        " detail=" + res.path("detail").asText(""));
            } else {
                getLogger().info("[PIAREA] 보상 지급을 완료했습니다!! delta=" + normalized +
                        " cash=" + res.path("data").path("cash_pia").asText(""));
            }
            return ok;
        } catch (Exception e) {
            getLogger().warning("[PIAREA] 보상 지급 중 오류가 발생했습니다... " + e.getMessage());
            return false;
        }
    }
    private void startScoreboardTask() {
        new BukkitRunnable() {
            @Override
            public void run() {
                if (accounts.isEmpty()) return;
                Map<String, Ranking> rankingsByUserId = new HashMap<>();
                try {
                    rankingsByUserId = fetchUserRankings();
                } catch (Exception ex) {
                    getLogger().warning("[PIAREA] 유저 시즌 랭킹을 불러오는 데 실패했습니다... " + ex.getMessage());
                }
                if (rankingsByUserId.isEmpty()) return;
                long now = System.currentTimeMillis();
                Map<UUID, Double> localRates = new HashMap<>();
                Map<UUID, Integer> localRanks = new HashMap<>();
                for (Map.Entry<UUID, Account> e : accounts.entrySet()) {
                    Player p = Bukkit.getPlayer(e.getKey());
                    if (p == null || !p.isOnline()) continue;
                    Account acc = e.getValue();
                    try {
                        Capitals cap = fetchCapitals(acc);
                        List<Holding> holds = holdingsCache.getOrDefault(p.getUniqueId(), new ArrayList<>());
                        Long lastHoldTs = holdingsUpdatedAt.get(p.getUniqueId());
                        boolean needFetchHoldings = lastHoldTs == null || now - lastHoldTs > HOLDINGS_TTL_MS;
                        if (needFetchHoldings) {
                            try {
                                holds = fetchHoldings(acc);
                                holdingsCache.put(p.getUniqueId(), holds);
                                holdingsUpdatedAt.put(p.getUniqueId(), now);
                            } catch (Exception ex2) {
                                getLogger().warning("[PIAREA] 보유 자산을 다시 불러오는 데 실패했습니다... " + ex2.getMessage());
                            }
                        }
                        Ranking rk = rankingsByUserId.get(acc.id());
                        if (rk != null) {
                            localRates.put(p.getUniqueId(), rk.profitRate());
                            localRanks.put(p.getUniqueId(), rk.rank());
                        }
                        List<Holding> finalHolds = holds;
                        Bukkit.getScheduler().runTask(PiareaMinecraft.this, () -> updateScoreboard(p, cap, finalHolds));
                    } catch (Exception ex) {
                        getLogger().warning("[PIAREA] 정보를 불러오는 데 실패했습니다... " + ex.getMessage());
                    }
                }
                pnlRateByPlayer.clear();
                pnlRateByPlayer.putAll(localRates);
                pnlRankByPlayer.clear();
                pnlRankByPlayer.putAll(localRanks);
            }
        }.runTaskTimerAsynchronously(this, 20L, SCOREBOARD_INTERVAL_TICKS);
    }
    private Double bestPnlRate(List<Holding> holds) {
        if (holds == null || holds.isEmpty()) return null;
        Double best = null;
        for (Holding h : holds) {
            if (h.pnlRate() == null) continue;
            if (best == null || h.pnlRate() > best) best = h.pnlRate();
        }
        return best;
    }
    private boolean isCoinSymbol(String symbol) {
        if (symbol == null) return false;
        for (String s : COIN_SYMBOLS) {
            if (s.equalsIgnoreCase(symbol)) return true;
        }
        return false;
    }
    private boolean isStockSymbol(String symbol) {
        if (symbol == null) return false;
        for (String s : KRX_SYMBOLS) {
            if (s.equalsIgnoreCase(symbol)) return true;
        }
        for (String s : US_SYMBOLS) {
            if (s.equalsIgnoreCase(symbol)) return true;
        }
        return false;
    }
    private void initBossBar() {
        bossBar = Bukkit.createBossBar(bossBarMessages[0], BarColor.WHITE, BarStyle.SOLID);
        bossBar.setProgress(1.0);
        bossBar.setVisible(true);
        for (Player p : Bukkit.getOnlinePlayers()) bossBar.addPlayer(p);
        new BukkitRunnable() {
            @Override
            public void run() {
                if (bossBar == null) return;
                bossBarIndex = (bossBarIndex + 1) % bossBarMessages.length;
                bossBar.setTitle(bossBarMessages[bossBarIndex]);
            }
        }.runTaskTimer(this, BOSSBAR_INTERVAL_TICKS, BOSSBAR_INTERVAL_TICKS);
    }
    private void updateScoreboard(Player p, Capitals c) {
        updateScoreboard(p, c, null);
    }
    private void updateScoreboard(Player p, Capitals c, List<Holding> holdings) {
        try {
            ScoreboardManager mgr = Bukkit.getScoreboardManager();
            if (mgr == null) return;
            Scoreboard board = p.getScoreboard();
            if (board == null || board == mgr.getMainScoreboard()) board = mgr.getNewScoreboard();
            Objective obj = board.getObjective("piarea");
            if (obj == null) obj = board.registerNewObjective("piarea", "dummy", ChatColor.WHITE + "PIAREA");
            obj.setDisplayName(ChatColor.WHITE + "PIAREA");
            obj.setDisplaySlot(DisplaySlot.SIDEBAR);
            for (String entry : new HashSet<>(board.getEntries())) board.resetScores(entry);
            int line = 15;
            String cashLine = ChatColor.YELLOW + "현금(KRW): " + ChatColor.WHITE + String.format("%,.2f", c.cashKrw());
            obj.getScore(cashLine).setScore(line--);
            Double myRate = pnlRateByPlayer.get(p.getUniqueId());
            Integer myRank = pnlRankByPlayer.get(p.getUniqueId());
            if (myRate != null && myRank != null && line >= 1) {
                String rankRateLine = ChatColor.AQUA + "순위(수익률): " + ChatColor.WHITE +
                        myRank + "위 (" + String.format("%.2f%%", myRate) + ")";
                obj.getScore(rankRateLine).setScore(line--);
            }
            if (holdings != null && !holdings.isEmpty()) {
                for (Holding h : holdings) {
                    if (line < 1) break;
                    int unitsInt = (int) Math.round(h.units());
                    if (unitsInt == 0) continue;
                    String displayName = (h.name() != null && !h.name().isEmpty()) ? h.name() : h.symbol();
                    String unitLabel = isCoinSymbol(h.symbol()) ? "개" : (isStockSymbol(h.symbol()) ? "주" : "개");
                    String lineText = ChatColor.YELLOW + displayName + " " + ChatColor.WHITE + unitsInt + ChatColor.YELLOW + unitLabel;
                    String plain = ChatColor.stripColor(lineText);
                    if (plain.length() > 32) {
                        lineText = ChatColor.YELLOW + h.symbol() + " " + ChatColor.WHITE + unitsInt + ChatColor.YELLOW + unitLabel;
                    }
                    obj.getScore(lineText).setScore(line--);
                }
            }
            p.setScoreboard(board);
        } catch (Exception ex) {
            getLogger().warning("[PIAREA] 스코어보드를 업데이트하는 데 실패했습니다... " + ex.getMessage());
        }
    }
    private boolean inSpawnRegion(Location loc) {
        if (spawnCenter == null || loc == null || !Objects.equals(loc.getWorld(), spawnCenter.getWorld())) return false;
        double dx = loc.getX() - spawnCenter.getX();
        double dz = loc.getZ() - spawnCenter.getZ();
        return dx * dx + dz * dz <= spawnRadius * spawnRadius;
    }
    private boolean isLinked(Player p) {
        return p != null && accounts.containsKey(p.getUniqueId());
    }
    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        lockedNotice.remove(p.getUniqueId());
        if (bossBar != null) bossBar.addPlayer(p);
        Account saved = linkRecords.get(p.getName());
        if (saved != null) {
            accounts.put(p.getUniqueId(), saved);
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 저장된 계정으로 자동 연동되었습니다!!");
            Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
                try {
                    Capitals cap = fetchCapitals(saved);
                    List<Holding> holds = new ArrayList<>();
                    try {
                        holds = fetchHoldings(saved);
                        holdingsCache.put(p.getUniqueId(), holds);
                        holdingsUpdatedAt.put(p.getUniqueId(), System.currentTimeMillis());
                    } catch (Exception ex2) {
                        getLogger().warning("[PIAREA] 자동 연동 후 보유 자산을 불러오는 데 실패했습니다... " + ex2.getMessage());
                    }
                    List<Holding> finalHolds = holds;
                    Bukkit.getScheduler().runTask(this, () -> updateScoreboard(p, cap, finalHolds));
                } catch (Exception ex) {
                    getLogger().warning("[PIAREA] 자동 연동 후 요약 정보를 불러오는 데 실패했습니다... " + ex.getMessage());
                }
            });
            return;
        }
        if (!isLinked(p)) {
            if (spawnCenter != null) {
                Location rnd = randomSpawn(spawnCenter.getWorld());
                if (rnd != null) p.teleport(rnd);
                else p.teleport(spawnCenter);
            }
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 연동하기 전까지 움직일 수 없습니다...");
        } else {
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 이미 연동되어 있습니다!!");
        }
    }
    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        Player p = e.getPlayer();
        lockedNotice.remove(p.getUniqueId());
        if (bossBar != null) bossBar.removePlayer(p);
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGHEST)
    public void onMove(PlayerMoveEvent e) {
        Player p = e.getPlayer();
        if (!isLinked(p)) {
            if (!e.getFrom().toVector().equals(e.getTo().toVector())) e.setTo(e.getFrom());
            if (lockedNotice.add(p.getUniqueId())) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 연동 전에는 이동할 수 없습니다...");
            }
        }
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGHEST)
    public void onBlockBreak(BlockBreakEvent e) {
        Player p = e.getPlayer();
        if (inSpawnRegion(e.getBlock().getLocation()) || !isLinked(p)) {
            e.setCancelled(true);
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 이 구역에서는 블록을 부술 수 없습니다...");
        }
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGHEST)
    public void onBlockPlace(BlockPlaceEvent e) {
        Player p = e.getPlayer();
        if (inSpawnRegion(e.getBlock().getLocation()) || !isLinked(p)) {
            e.setCancelled(true);
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 이 구역에서는 블록을 설치할 수 없습니다...");
        }
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGHEST)
    public void onInteract(PlayerInteractEvent e) {
        Player p = e.getPlayer();
        boolean inSpawn = inSpawnRegion(p.getLocation());
        boolean linked = isLinked(p);
        if (inSpawn || !linked) {
            e.setCancelled(true);
            if (!linked) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 연동 전에는 상호작용을 할 수 없습니다...");
            } else {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 스폰 근처에서는 상호작용을 할 수 없습니다...");
            }
        }
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGHEST)
    public void onDrop(PlayerDropItemEvent e) {
        Player p = e.getPlayer();
        boolean inSpawn = inSpawnRegion(p.getLocation());
        boolean linked = isLinked(p);
        if (inSpawn || !linked) {
            e.setCancelled(true);
            if (!linked) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 연동 전에는 아이템을 버릴 수 없습니다...");
            } else {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 스폰 근처에서는 아이템을 버릴 수 없습니다...");
            }
        }
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGHEST)
    public void onPickup(PlayerPickupItemEvent e) {
        Player p = e.getPlayer();
        boolean inSpawn = inSpawnRegion(p.getLocation());
        boolean linked = isLinked(p);
        if (inSpawn || !linked) {
            e.setCancelled(true);
            if (!linked) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 연동 전에는 아이템을 줍기 어렵습니다...");
            } else {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 스폰 근처에서는 아이템을 줍기 어렵습니다...");
            }
        }
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGHEST)
    public void onDamage(EntityDamageByEntityEvent e) {
        if (!(e.getDamager() instanceof Player attacker)) return;
        boolean inSpawn = inSpawnRegion(attacker.getLocation());
        boolean linked = isLinked(attacker);
        if (inSpawn || !linked) {
            e.setCancelled(true);
            if (!linked) {
                attacker.sendMessage(ChatColor.WHITE + "[PIAREA] 연동 전에는 공격할 수 없습니다...");
            } else {
                attacker.sendMessage(ChatColor.WHITE + "[PIAREA] 스폰 근처에서는 공격할 수 없습니다...");
            }
        }
    }
    @Override
    public boolean onCommand(@NotNull CommandSender s, @NotNull Command cmd, @NotNull String lbl, @NotNull String[] args) {
        if (!cmd.getName().equalsIgnoreCase("piarea") && !cmd.getName().equalsIgnoreCase("pairea")) return false;
        if (!(s instanceof Player p)) {
            s.sendMessage(ChatColor.RED + "[PIAREA] 마인크래프트 서버 안에서만 사용할 수 있습니다...");
            return true;
        }
        if (args.length == 0) {
            sendUsage(p);
            return true;
        }
        String sub = args[0].toLowerCase();
        if (sub.equals("signup")) {
            if (args.length != 3) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 사용법: /piarea signup <유저명> <비밀번호>");
                return true;
            }
            handleSignup(p, args[1], args[2]);
            return true;
        }
        if (sub.equals("signin")) {
            if (args.length != 3) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 사용법: /piarea signin <유저명> <비밀번호>");
                return true;
            }
            handleSignin(p, args[1], args[2]);
            return true;
        }
        if (sub.equals("gui")) {
            if (!isLinked(p)) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 먼저 계정을 연동해 주십시오...");
                return true;
            }
            openMainGui(p);
            return true;
        }
        if (sub.equals("w")) {
            if (args.length < 3) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 사용법: /piarea w <플레이어명> <내용>");
                return true;
            }
            String targetName = args[1];
            Player target = Bukkit.getPlayerExact(targetName);
            if (target == null || !target.isOnline()) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] 해당 플레이어를 찾을 수 없습니다...");
                return true;
            }
            String msg = String.join(" ", java.util.Arrays.copyOfRange(args, 2, args.length));
            target.sendMessage(ChatColor.GRAY + "[PIAREA] [귓속말] " + p.getName() + ": " + msg);
            p.sendMessage(ChatColor.GRAY + "[PIAREA] [귓속말] " + target.getName() + "에게 보냈습니다!!");
            return true;
        }
        sendUsage(p);
        return true;
    }
    private void sendUsage(Player p) {
        p.sendMessage(ChatColor.WHITE + "[PIAREA] 사용법: /piarea signup | signin | gui | w");
    }
    private boolean isIdLinkedToAnotherPlayer(String id, String currentName) {
        for (Map.Entry<String, Account> e : linkRecords.entrySet()) {
            Account a = e.getValue();
            if (a != null && a.id().equals(id) && !e.getKey().equalsIgnoreCase(currentName)) return true;
        }
        return false;
    }
    private void handleSignup(Player p, String id, String password) {
        if (accounts.containsKey(p.getUniqueId()) || linkRecords.containsKey(p.getName())) {
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 이미 이 마인크래프트 계정은 연동되어 있습니다!!");
            return;
        }
        if (isIdLinkedToAnotherPlayer(id, p.getName())) {
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 이미 다른 마인크래프트 계정과 연동된 PIAREA 아이디입니다...");
            return;
        }
        p.sendMessage(ChatColor.WHITE + "[PIAREA] 회원가입을 시도하고 있습니다!!");
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            Account acc = new Account(id, password);
            try {
                JsonNode body = om.createObjectNode()
                        .put("id", acc.id())
                        .put("password", acc.password());
                JsonNode res = postJson("/v1/users/signup", body, true);
                boolean ok = res.path("ok").asBoolean(false);
                if (!ok) {
                    String code = res.path("code").asText("");
                    String detail = res.path("detail").asText("");
                    getLogger().warning("[PIAREA] 회원가입 요청이 실패했습니다... code=" + code + " detail=" + detail);
                    Bukkit.getScheduler().runTask(this, () ->
                            p.sendMessage(ChatColor.RED + "[PIAREA] 회원가입에 실패했습니다..."));
                    return;
                }
                Capitals cap = fetchCapitals(acc);
                List<Holding> holds = new ArrayList<>();
                try {
                    holds = fetchHoldings(acc);
                    holdingsCache.put(p.getUniqueId(), holds);
                    holdingsUpdatedAt.put(p.getUniqueId(), System.currentTimeMillis());
                } catch (Exception ex2) {
                    getLogger().warning("[PIAREA] 회원가입 후 보유 자산을 불러오는 데 실패했습니다... " + ex2.getMessage());
                }
                List<Holding> finalHolds = holds;
                if (!linkRecords.containsKey(p.getName())) {
                    linkRecords.put(p.getName(), acc);
                    appendLinkRecord(p.getName(), acc);
                }
                accounts.put(p.getUniqueId(), acc);
                lockedNotice.remove(p.getUniqueId());
                Bukkit.getScheduler().runTask(this, () -> {
                    p.sendMessage(ChatColor.WHITE + "[PIAREA] 회원가입과 계정 연동이 완료되었습니다!!");
                    updateScoreboard(p, cap, finalHolds);
                });
            } catch (Exception ex) {
                getLogger().warning("[PIAREA] 회원가입을 처리하는 중 오류가 발생했습니다... " + ex.getMessage());
                Bukkit.getScheduler().runTask(this, () ->
                        p.sendMessage(ChatColor.RED + "[PIAREA] 회원가입 처리 중 오류가 발생했습니다..."));
            }
        });
    }
    private void handleSignin(Player p, String id, String password) {
        if (accounts.containsKey(p.getUniqueId()) || linkRecords.containsKey(p.getName())) {
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 이미 이 마인크래프트 계정은 연동되어 있습니다!!");
            return;
        }
        if (isIdLinkedToAnotherPlayer(id, p.getName())) {
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 이미 다른 마인크래프트 계정과 연동된 PIAREA 아이디입니다...");
            return;
        }
        p.sendMessage(ChatColor.WHITE + "[PIAREA] 연동을 시도하고 있습니다!!");
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            Account acc = new Account(id, password);
            try {
                Capitals cap = fetchCapitals(acc);
                List<Holding> holds = new ArrayList<>();
                try {
                    holds = fetchHoldings(acc);
                    holdingsCache.put(p.getUniqueId(), holds);
                    holdingsUpdatedAt.put(p.getUniqueId(), System.currentTimeMillis());
                } catch (Exception ex2) {
                    getLogger().warning("[PIAREA] 연동 후 보유 자산을 불러오는 데 실패했습니다... " + ex2.getMessage());
                }
                List<Holding> finalHolds = holds;
                if (!linkRecords.containsKey(p.getName())) {
                    linkRecords.put(p.getName(), acc);
                    appendLinkRecord(p.getName(), acc);
                }
                accounts.put(p.getUniqueId(), acc);
                lockedNotice.remove(p.getUniqueId());
                Bukkit.getScheduler().runTask(this, () -> {
                    p.sendMessage(ChatColor.WHITE + "[PIAREA] 연동이 완료되었습니다!!");
                    updateScoreboard(p, cap, finalHolds);
                });
            } catch (Exception ex) {
                getLogger().warning("[PIAREA] 연동을 처리하는 중 오류가 발생했습니다... " + ex.getMessage());
                Bukkit.getScheduler().runTask(this, () ->
                        p.sendMessage(ChatColor.RED + "[PIAREA] 연동에 실패했습니다..."));
            }
        });
    }
    private void openMainGui(Player p) {
        Inventory inv = Bukkit.createInventory(p, 9, MAIN_GUI_TITLE);
        ItemStack reward = new ItemStack(Material.IRON_PICKAXE);
        ItemMeta rewardMeta = reward.getItemMeta();
        rewardMeta.setDisplayName(ChatColor.GOLD + "광물 보상");
        rewardMeta.setLore(List.of(
                ChatColor.WHITE + "채굴한 광물을 넣고",
                ChatColor.WHITE + "현금(KRW) 보상으로 바꿀 수 있습니다!!"
        ));
        reward.setItemMeta(rewardMeta);
        inv.setItem(1, reward);
        ItemStack coins = new ItemStack(Material.GOLD_INGOT);
        ItemMeta coinsMeta = coins.getItemMeta();
        coinsMeta.setDisplayName(ChatColor.YELLOW + "코인");
        coinsMeta.setLore(List.of(
                ChatColor.WHITE + "코인 자산을 종이로 보고",
                ChatColor.WHITE + "우클릭: 매수(1개) / 좌클릭: 매도(1개)"
        ));
        coins.setItemMeta(coinsMeta);
        inv.setItem(3, coins);
        ItemStack stocksKr = new ItemStack(Material.PAPER);
        ItemMeta stocksKrMeta = stocksKr.getItemMeta();
        stocksKrMeta.setDisplayName(ChatColor.YELLOW + "국내 주식");
        stocksKrMeta.setLore(List.of(
                ChatColor.WHITE + "국내 주식 자산을 종이로 보고",
                ChatColor.WHITE + "우클릭: 매수(1주) / 좌클릭: 매도(1주)"
        ));
        stocksKr.setItemMeta(stocksKrMeta);
        inv.setItem(5, stocksKr);
        ItemStack stocksUs = new ItemStack(Material.PAPER);
        ItemMeta stocksUsMeta = stocksUs.getItemMeta();
        stocksUsMeta.setDisplayName(ChatColor.YELLOW + "미국 주식");
        stocksUsMeta.setLore(List.of(
                ChatColor.WHITE + "미국 주식 자산을 빈 종이로 보고",
                ChatColor.WHITE + "우클릭: 매수(1주) / 좌클릭: 매도(1주)"
        ));
        stocksUs.setItemMeta(stocksUsMeta);
        inv.setItem(7, stocksUs);
        p.openInventory(inv);
        p.sendMessage(ChatColor.WHITE + "[PIAREA] PIAREA 메뉴를 열었습니다!!");
    }
    private void openRewardGui(Player p) {
        Inventory inv = Bukkit.createInventory(p, 9, REWARD_TITLE);
        p.openInventory(inv);
        p.sendMessage(ChatColor.WHITE + "[PIAREA] 보상 메뉴를 열었습니다!!");
    }
    private void openAssetGui(Player p, Component title, String[] symbols) {
        Inventory inv = Bukkit.createInventory(p, 45, title);
        List<Holding> holds = holdingsCache.getOrDefault(p.getUniqueId(), new ArrayList<>());
        String unitLabel;
        if (title.equals(COINS_GUI_TITLE)) unitLabel = "개";
        else if (title.equals(STOCKS_KR_GUI_TITLE) || title.equals(STOCKS_US_GUI_TITLE)) unitLabel = "주";
        else unitLabel = "개";
        for (int i = 0; i < symbols.length && i < inv.getSize(); i++) {
            String symbol = symbols[i];
            int unitsInt = 0;
            for (Holding h : holds) {
                if (symbol.equalsIgnoreCase(h.symbol())) {
                    unitsInt = (int) Math.round(h.units());
                    break;
                }
            }
            ItemStack paper = new ItemStack(Material.PAPER);
            ItemMeta meta = paper.getItemMeta();
            meta.setDisplayName(ChatColor.YELLOW + symbol + ChatColor.WHITE + " 자산");
            List<String> lore = new ArrayList<>();
            lore.add(ChatColor.WHITE + "보유: " + unitsInt + unitLabel);
            lore.add(ChatColor.GRAY + "우클릭: 매수(1" + unitLabel + ")");
            lore.add(ChatColor.GRAY + "좌클릭: 매도(1" + unitLabel + ")");
            meta.setLore(lore);
            PersistentDataContainer pdc = meta.getPersistentDataContainer();
            pdc.set(assetKey, PersistentDataType.STRING, symbol);
            paper.setItemMeta(meta);
            inv.setItem(i, paper);
        }
        p.openInventory(inv);
        p.sendMessage(ChatColor.WHITE + "[PIAREA] 자산 메뉴를 열었습니다!!");
    }
    private void openCoinsGui(Player p) {
        openAssetGui(p, COINS_GUI_TITLE, COIN_SYMBOLS);
    }
    private void openStocksKrGui(Player p) {
        openAssetGui(p, STOCKS_KR_GUI_TITLE, KRX_SYMBOLS);
    }
    private void openStocksUsGui(Player p) {
        openAssetGui(p, STOCKS_US_GUI_TITLE, US_SYMBOLS);
    }
    private String getSymbolFromItem(ItemStack it) {
        if (it == null) return null;
        ItemMeta meta = it.getItemMeta();
        if (meta == null) return null;
        PersistentDataContainer pdc = meta.getPersistentDataContainer();
        if (pdc.has(assetKey, PersistentDataType.STRING)) {
            return pdc.get(assetKey, PersistentDataType.STRING);
        }
        String name = meta.getDisplayName();
        if (name == null) return null;
        String stripped = ChatColor.stripColor(name).trim();
        int idx = stripped.indexOf(' ');
        if (idx > 0) return stripped.substring(0, idx).trim();
        return stripped;
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.MONITOR)
    public void onInventoryClick(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player p)) return;
        Component title = e.getView().title();
        ItemStack clicked = e.getCurrentItem();
        int rawSlot = e.getRawSlot();
        if (title.equals(MAIN_GUI_TITLE)) {
            e.setCancelled(true);
            if (rawSlot < 0 || rawSlot >= 9) return;
            if (rawSlot == 1) {
                openRewardGui(p);
            } else if (rawSlot == 3) {
                if (!isLinked(p)) {
                    p.sendMessage(ChatColor.WHITE + "[PIAREA] 먼저 PIAREA와 연동해 주십시오...");
                    return;
                }
                openCoinsGui(p);
            } else if (rawSlot == 5) {
                if (!isLinked(p)) {
                    p.sendMessage(ChatColor.WHITE + "[PIAREA] 먼저 PIAREA와 연동해 주십시오...");
                    return;
                }
                openStocksKrGui(p);
            } else if (rawSlot == 7) {
                if (!isLinked(p)) {
                    p.sendMessage(ChatColor.WHITE + "[PIAREA] 먼저 PIAREA와 연동해 주십시오...");
                    return;
                }
                openStocksUsGui(p);
            }
            return;
        }
        if (title.equals(COINS_GUI_TITLE) || title.equals(STOCKS_KR_GUI_TITLE) || title.equals(STOCKS_US_GUI_TITLE)) {
            if (rawSlot < 0 || rawSlot >= e.getView().getTopInventory().getSize()) return;
            e.setCancelled(true);
            if (clicked == null || clicked.getType() != Material.PAPER) return;
            String symbol = getSymbolFromItem(clicked);
            if (symbol == null || symbol.isEmpty()) return;
            Account acc = accounts.get(p.getUniqueId());
            if (acc == null) {
                p.sendMessage(ChatColor.WHITE + "[PIAREA] PIAREA 연동 후에만 자산을 거래할 수 있습니다...");
                return;
            }
            ClickType ct = e.getClick();
            String side = null;
            if (ct == ClickType.RIGHT || ct == ClickType.SHIFT_RIGHT) side = "buy";
            else if (ct == ClickType.LEFT || ct == ClickType.SHIFT_LEFT) side = "sell";
            if (side == null) return;
            sendOrder(p, acc, symbol, side);
        }
    }
    private void sendOrder(Player p, Account acc, String symbol, String side) {
        p.sendMessage(ChatColor.WHITE + "[PIAREA] " + symbol + " " + (side.equals("buy") ? "매수" : "매도") + " 주문을 시도하고 있습니다!!");
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            try {
                JsonNode body = om.createObjectNode()
                        .put("id", acc.id())
                        .put("password", acc.password())
                        .put("symbol", symbol)
                        .put("side", side)
                        .put("type", "market")
                        .put("quantity", 1);
                JsonNode res = postJson("/v1/orders", body, true);
                boolean ok = res.path("ok").asBoolean(false);
                if (!ok) {
                    String code = res.path("code").asText("");
                    String detail = res.path("detail").asText("");
                    getLogger().warning("[PIAREA] 주문이 실패했습니다... symbol=" + symbol +
                            " side=" + side + " code=" + code + " detail=" + detail);
                    Bukkit.getScheduler().runTask(this, () ->
                            p.sendMessage(ChatColor.RED + "[PIAREA] 주문 처리에 실패했습니다..."));
                    return;
                }
                try {
                    Capitals cap = fetchCapitals(acc);
                    List<Holding> holds = fetchHoldings(acc);
                    holdingsCache.put(p.getUniqueId(), holds);
                    holdingsUpdatedAt.put(p.getUniqueId(), System.currentTimeMillis());
                    Bukkit.getScheduler().runTask(this, () -> updateScoreboard(p, cap, holds));
                } catch (Exception ex2) {
                    getLogger().warning("[PIAREA] 주문 후 자산을 갱신하는 데 실패했습니다... " + ex2.getMessage());
                }
                Bukkit.getScheduler().runTask(this, () ->
                        p.sendMessage(ChatColor.WHITE + "[PIAREA] " + symbol + " " +
                                (side.equals("buy") ? "매수" : "매도") + " 주문이 처리되었습니다!!"));
            } catch (Exception ex) {
                getLogger().warning("[PIAREA] 주문을 처리하는 중 오류가 발생했습니다... " + ex.getMessage());
                Bukkit.getScheduler().runTask(this, () ->
                        p.sendMessage(ChatColor.RED + "[PIAREA] 주문 처리 중 오류가 발생했습니다..."));
            }
        });
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.MONITOR)
    public void onClose(InventoryCloseEvent e) {
        if (!(e.getPlayer() instanceof Player p)) return;
        if (!e.getView().title().equals(REWARD_TITLE)) return;
        Account acc = accounts.get(p.getUniqueId());
        if (acc == null) {
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 연동 후에만 광물 보상을 받을 수 있습니다...");
            return;
        }
        Inventory inv = e.getInventory();
        double delta = 0.0;
        for (ItemStack it : inv.getContents()) {
            if (it == null) continue;
            delta += rewardDeltaFor(it.getType()) * it.getAmount();
        }
        inv.clear();
        if (delta <= 0.0) {
            p.sendMessage(ChatColor.WHITE + "[PIAREA] 광물 보상이 없습니다!!");
            return;
        }
        double pay = delta;
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            boolean ok = postReward(acc, pay);
            Bukkit.getScheduler().runTask(this, () -> {
                if (ok) {
                    p.sendMessage(ChatColor.WHITE + "[PIAREA] " + String.format("%,.2f PIA 지급이 완료되었습니다!!", pay));
                } else {
                    p.sendMessage(ChatColor.RED + "[PIAREA] 광물 보상 지급에 실패했습니다...");
                }
            });
        });
    }
    private double rewardDeltaFor(Material m) {
        if (m == Material.COAL || m == Material.COPPER_INGOT) return 0.1;
        if (m == Material.LAPIS_LAZULI || m == Material.REDSTONE) return 1.0;
        if (m == Material.IRON_INGOT || m == Material.GOLD_INGOT) return 10.0;
        if (m == Material.DIAMOND || m == Material.EMERALD) return 100.0;
        if (m == Material.NETHERITE_INGOT) return 500.0;
        return 0.0;
    }
    @EventHandler(ignoreCancelled = true, priority = EventPriority.MONITOR)
    public void onPlayerKill(PlayerDeathEvent e) {
        Player victim = e.getEntity();
        Player killer = victim.getKiller();
        if (killer == null) return;
        Account acc = accounts.get(killer.getUniqueId());
        if (acc == null) {
            killer.sendMessage(ChatColor.WHITE + "[PIAREA] 플레이어 처치 보상은 연동 후에 지급됩니다...");
            return;
        }
        double pay = 100.0;
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            boolean ok = postReward(acc, pay);
            Bukkit.getScheduler().runTask(this, () -> {
                if (ok) {
                    killer.sendMessage(ChatColor.WHITE + "[PIAREA] 플레이어 처치 보상으로 100 PIA가 지급되었습니다!!");
                } else {
                    killer.sendMessage(ChatColor.RED + "[PIAREA] 플레이어 처치 보상 지급에 실패했습니다...");
                }
            });
        });
    }
}