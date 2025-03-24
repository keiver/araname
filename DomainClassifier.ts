/**
 * Enhanced domain environment classifier with confidence levels
 * and time-based cache expiry for React Native applications.
 */

/**
 * Classification result with confidence level
 */
export interface DomainClassification {
  // Is this a development environment
  isDevelopment: boolean
  // Confidence level (0-100)
  confidence: number
  // Reasons for classification (debug info)
  reasons: string[]
  // Classification timestamp
  timestamp: number
}

/**
 * Classification options
 */
export interface ClassificationOptions {
  // Skip checking development TLDs
  skipTldCheck?: boolean
  // Skip checking development subdomains
  skipSubdomainCheck?: boolean
  // Skip checking development ports
  skipPortCheck?: boolean
  // Skip checking development paths
  skipPathCheck?: boolean
  // Skip checking query parameters
  skipQueryCheck?: boolean
  // Additional domains to consider as development environments
  additionalDevDomains?: string[]
  // Additional domains to consider as production environments
  additionalProdDomains?: string[]
  // Allowlist of domains that should always be considered production regardless of other factors
  allowlist?: string[]
  // Blocklist of domains that should always be considered development regardless of other factors
  blocklist?: string[]
  // Enable memoization for better performance when checking the same URLs repeatedly
  enableMemoization?: boolean
  // Cache TTL in milliseconds (default: 1 hour)
  cacheTtl?: number
  // Minimum confidence threshold to consider a result reliable (0-100)
  confidenceThreshold?: number
  // Log detailed information about the detection process
  debug?: boolean
}

/**
 * Cache entry with expiry
 */
interface CacheEntry {
  classification: DomainClassification
  expiresAt: number
}

class DomainEnvironmentClassifier {
  // Default options
  private readonly defaultOptions: ClassificationOptions = {
    enableMemoization: true,
    cacheTtl: 60 * 60 * 1000, // 1 hour
    confidenceThreshold: 70, // Default confidence threshold
    debug: false
  }

  // Cache for memoization
  private cache: Map<string, CacheEntry> = new Map()
  private readonly MAX_CACHE_SIZE = 1000

  // Constants for classification
  private readonly PRODUCTION_TLDS = new Set([
    ".com",
    ".org",
    ".net",
    ".io",
    ".co",
    ".edu",
    ".gov",
    ".mil",
    ".biz",
    ".info",
    ".name",
    ".pro",
    ".int",
    ".museum",
    ".aero",
    ".jobs",
    ".mobi",
    ".app",
    ".dev",
    ".tech",
    ".store",
    ".blog"
  ])

  private readonly MAJOR_DOMAINS = new Set([
    "facebook.com",
    "google.com",
    "youtube.com",
    "instagram.com",
    "twitter.com",
    "linkedin.com",
    "github.com",
    "pinterest.com",
    "amazon.com",
    "netflix.com",
    "apple.com",
    "microsoft.com",
    "medium.com",
    "wordpress.com",
    "blogger.com",
    "shopify.com"
  ])

  private readonly DEV_TLDS = new Set([
    ".test",
    ".local",
    ".localhost",
    ".example",
    ".invalid",
    ".internal",
    ".testing",
    ".staging",
    ".development"
  ])

  private readonly DEV_SUBDOMAINS = new Set([
    "dev.",
    "staging.",
    "test.",
    "uat.",
    "qa.",
    "sandbox.",
    "preview.",
    "beta.",
    "development.",
    "local.",
    "demo.",
    "stg.",
    "preprod.",
    "pre-prod.",
    "stage."
  ])

  private readonly DEV_PORTS = new Set([
    "3000",
    "4200",
    "5000",
    "8000",
    "8080",
    "8888",
    "9000",
    "1337",
    "4000",
    "4040",
    "5173",
    "8081",
    "9001",
    "9090",
    "3001",
    "3030",
    "5050",
    "8001",
    "8443",
    "9080",
    "4321",
    "2368",
    "7000",
    "7001",
    "1234",
    "6660",
    "6661",
    "6662",
    "6663",
    "6664",
    "6665",
    "6666",
    "6667",
    "6668",
    "6669"
  ])

  private readonly DEV_PATHS = new Set([
    "/dev/",
    "/test/",
    "/staging/",
    "/uat/",
    "/demo/",
    "/mock/",
    "/sample/",
    "/debug/",
    "/development/",
    "/testing/",
    "/sandbox/",
    "/beta/",
    "/preview/",
    "/local/",
    "/temp/",
    "/dummy/",
    "/fake/"
  ])

  private readonly DEV_SERVER_DOMAINS = new Set([
    "ngrok.io",
    "ngrok-free.app",
    "loca.lt",
    "localhost.run",
    "serveo.net",
    "pagekite.me",
    "localtunnel.me",
    "gitpod.io",
    "repl.it",
    "replit.com",
    "glitch.me",
    "vercel.app",
    "netlify.app",
    "netlify.com",
    "herokuapp.com",
    "workers.dev",
    "codepen.io",
    "codesandbox.io",
    "stackblitz.io",
    "github.dev",
    "github.io",
    "pages.dev",
    "surge.sh",
    "azurewebsites.net",
    "cloudfront.net",
    "amplifyapp.com"
  ])

  private readonly LOCAL_HOSTNAMES = new Set([
    "localserver",
    "devserver",
    "testserver",
    "myapp",
    "mysite",
    "testsite",
    "devsite",
    "development",
    "testapp",
    "devapp",
    "localhost-alias",
    "testhost",
    "mylocal",
    "dev-machine",
    "dev-laptop",
    "dev-desktop"
  ])

  private readonly CONTAINER_DOMAINS = new Set([
    "svc.cluster.local",
    "docker.internal",
    "localhost.internal",
    "internal",
    "service.consul",
    "nip.io",
    "xip.io",
    "k8s.local",
    "rancher.internal",
    "docker.local"
  ])

  private readonly CICD_INDICATORS = new Set([
    "ci.",
    "ci-",
    "pr-",
    "build-",
    "pipeline-",
    "jenkins",
    "circleci",
    "travis",
    "github-actions",
    "gitlab-ci",
    "build.",
    "drone-ci",
    "actions-runner",
    "teamcity",
    "bamboo",
    "azure-pipelines"
  ])

  private readonly LOCALHOST_VARIANTS = new Set([
    "localhost",
    "localdomain",
    "127.0.0.1",
    "[::1]",
    "локалхост",
    "ローカルホスト",
    "로컬호스트",
    "本地主机",
    "本地",
    "محلي"
  ])

  /**
   * Constructor
   */
  constructor() {
    // Set up periodic cache cleanup
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanupCache(), 5 * 60 * 1000) // Every 5 minutes
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    let expiredCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key)
        expiredCount++
      }
    }

    if (expiredCount > 0 && this.defaultOptions.debug) {
      console.log(`[DomainClassifier] Cleaned up ${expiredCount} expired cache entries`)
    }
  }

  /**
   * Add URL to cache with expiration
   */
  private cacheResult(url: string, classification: DomainClassification, ttl: number): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (first key) when max size reached
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(url, {
      classification,
      expiresAt: Date.now() + ttl
    })
  }

  /**
   * Helper function to match domain against allowlist or blocklist with support for wildcards
   */
  private matchesDomainList(hostname: string, domainList: string[]): boolean {
    return domainList.some(pattern => {
      // Exact match
      if (pattern === hostname) return true

      // Subdomain match (*.example.com)
      if (pattern.startsWith("*.") && hostname.endsWith(pattern.substring(1))) return true

      // Domain with any subdomain (example.com and *.example.com)
      if (!pattern.startsWith("*.") && (hostname === pattern || hostname.endsWith(`.${pattern}`))) return true

      return false
    })
  }

  /**
   * Checks if a hostname is a known local or private IP address
   */
  private isLocalIpAddress(hostname: string): boolean {
    // Check for localhost and loopback variants
    if (this.LOCALHOST_VARIANTS.has(hostname)) {
      return true
    }

    // Check for IPv4 private ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const ipv4Match = hostname.match(ipv4Regex)

    if (ipv4Match) {
      const [_, a, b, c, d] = ipv4Match.map(Number)

      // 10.0.0.0/8
      if (a === 10) return true

      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true

      // 192.168.0.0/16
      if (a === 192 && b === 168) return true

      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return true

      // 127.0.0.0/8 (loopback) - additional check beyond localhost
      if (a === 127) return true

      // 100.64.0.0/10 (Carrier-grade NAT)
      if (a === 100 && b >= 64 && b <= 127) return true
    }

    // IPv6 private/local ranges check
    if (
      hostname.startsWith("[fd") || // Unique local addresses fd00::/8
      hostname.startsWith("[fe80:") || // Link-local fe80::/10
      hostname.startsWith("[::ffff:") || // IPv4-mapped addresses
      hostname.startsWith("[fc00:") || // Another format for unique local
      hostname.startsWith("[::1") || // Loopback
      hostname.includes("fc00::") ||
      hostname.includes("fe80::")
    ) {
      return true
    }

    return false
  }

  /**
   * Checks for container or orchestration environment domains
   */
  private isContainerEnvironment(hostname: string): boolean {
    // Check for container-specific domain patterns
    if ([...this.CONTAINER_DOMAINS].some(domain => hostname.endsWith(domain))) {
      return true
    }

    // Check for Kubernetes service pattern: service-name.namespace.svc.cluster.local
    if (/^[a-z0-9-]+\.[a-z0-9-]+\.svc\.cluster\.local$/.test(hostname)) {
      return true
    }

    // Check for Docker container IDs in hostnames
    if (/^[a-f0-9]{12}$/.test(hostname)) {
      return true
    }

    // Check for IP literals commonly used in container networking
    if (hostname.startsWith("10.") || hostname.startsWith("172.") || hostname.startsWith("192.168.")) {
      if (hostname.split(".").length === 4 && hostname.split(".").every(part => !isNaN(Number(part)))) {
        return true
      }
    }

    return false
  }

  /**
   * Checks if a hostname is likely a CI/CD environment
   */
  private isCICDEnvironment(hostname: string): boolean {
    // Check for CI/CD pattern indicators
    if ([...this.CICD_INDICATORS].some(indicator => hostname.includes(indicator) || hostname.startsWith(indicator))) {
      return true
    }

    // Check for PR deployment pattern: pr-123.example.com
    if (/^pr-\d+/.test(hostname) || /\.pr-\d+/.test(hostname)) {
      return true
    }

    // Check for commit SHA pattern in hostname
    if (/[a-f0-9]{7,40}/.test(hostname) && (hostname.includes("-") || hostname.includes("."))) {
      return true
    }

    return false
  }

  /**
   * Checks if a hostname is likely a cloud provider ephemeral environment
   */
  private isCloudEphemeralEnvironment(hostname: string): boolean {
    // AWS patterns
    if (
      hostname.includes(".cloudfront.net") ||
      hostname.includes(".elasticbeanstalk.com") ||
      hostname.includes(".amazonaws.com") ||
      hostname.includes(".execute-api.") ||
      /d[a-z0-9]+\.cloudfront\.net$/.test(hostname)
    ) {
      return true
    }

    // Azure patterns
    if (hostname.includes(".azurewebsites.net") && (hostname.includes("-staging") || hostname.includes("-test"))) {
      return true
    }

    // Google Cloud patterns
    if (
      hostname.includes(".run.app") ||
      hostname.includes(".appspot.com") ||
      hostname.includes(".cloudfunctions.net")
    ) {
      return true
    }

    // Vercel and Netlify preview deployments
    if (
      (hostname.includes("vercel.app") || hostname.includes("netlify.app")) &&
      (hostname.includes("preview") || hostname.includes("deploy-preview"))
    ) {
      return true
    }

    return false
  }

  /**
   * Checks if a hostname is likely a production domain
   */
  private isLikelyProductionDomain(hostname: string, options?: ClassificationOptions): boolean {
    // Check allowlist first if provided
    if (options?.allowlist?.length) {
      if (this.matchesDomainList(hostname, options.allowlist)) {
        return true
      }
    }

    // Check for exact matches with major domains
    if (this.MAJOR_DOMAINS.has(hostname) || [...this.MAJOR_DOMAINS].some(domain => hostname.endsWith(`.${domain}`))) {
      return true
    }

    // Check additional production domains if provided
    if (options?.additionalProdDomains?.length) {
      if (this.matchesDomainList(hostname, options.additionalProdDomains)) {
        return true
      }
    }

    // Check for common chain patterns that indicate dev environments
    if (this.isDevSubdomainChain(hostname)) {
      return false
    }

    // If it has a common production TLD and doesn't have development indicators
    return (
      [...this.PRODUCTION_TLDS].some(tld => hostname.endsWith(tld)) &&
      !hostname.includes("dev.") &&
      !hostname.includes("test.") &&
      !hostname.includes("staging.") &&
      !hostname.includes("uat.") &&
      !hostname.includes("qa.")
    )
  }

  /**
   * Checks for complex subdomain chains that indicate development environments
   */
  private isDevSubdomainChain(hostname: string): boolean {
    const parts = hostname.split(".")

    // Check for patterns like dev.api.example.com or api.dev.example.com
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i].toLowerCase()
      if (
        part === "dev" ||
        part === "test" ||
        part === "staging" ||
        part === "qa" ||
        part === "uat" ||
        part === "sandbox"
      ) {
        return true
      }
    }

    // Check for more complex patterns
    const fullHostname = hostname.toLowerCase()
    return (
      fullHostname.includes(".dev.") ||
      fullHostname.includes(".test.") ||
      fullHostname.includes(".staging.") ||
      fullHostname.includes(".qa.") ||
      fullHostname.includes(".uat.") ||
      fullHostname.includes(".sandbox.")
    )
  }

  /**
   * Checks if development query parameters are present
   */
  private hasDevQueryParams(searchParams: URLSearchParams): boolean {
    return (
      searchParams.has("dev") ||
      searchParams.has("test") ||
      searchParams.has("debug") ||
      searchParams.has("preview") ||
      searchParams.has("staging") ||
      searchParams.has("development") ||
      searchParams.has("local") ||
      searchParams.has("environment") ||
      searchParams.get("env") === "dev" ||
      searchParams.get("env") === "development" ||
      searchParams.get("env") === "staging" ||
      searchParams.get("env") === "test" ||
      searchParams.get("mode") === "dev" ||
      searchParams.get("mode") === "development"
    )
  }

  /**
   * Classify a URL with confidence level
   */
  public classifyUrl(url: string, options?: ClassificationOptions): DomainClassification {
    const mergedOptions = {...this.defaultOptions, ...options}
    const {enableMemoization, cacheTtl, debug} = mergedOptions

    if (!url || typeof url !== "string") {
      return {
        isDevelopment: false,
        confidence: 100,
        reasons: ["Invalid URL"],
        timestamp: Date.now()
      }
    }

    // Check cache first if memoization is enabled
    if (enableMemoization) {
      const cachedResult = this.cache.get(url)
      if (cachedResult && cachedResult.expiresAt > Date.now()) {
        return cachedResult.classification
      }
    }

    try {
      // Initialize classification result
      const result: DomainClassification = {
        isDevelopment: false,
        confidence: 50, // Default confidence
        reasons: [],
        timestamp: Date.now()
      }

      // Handle edge cases first for quick early returns
      if (url.startsWith("data:") || url.startsWith("blob:")) {
        result.isDevelopment = false
        result.confidence = 100
        result.reasons.push("Data or blob URL")

        if (enableMemoization) {
          this.cacheResult(url, result, cacheTtl!)
        }
        return result
      }

      // Try to parse URL
      let parsedUrl: URL
      try {
        parsedUrl = new URL(url)
      } catch (error) {
        // Invalid URL, assume not a dev environment
        result.isDevelopment = false
        result.confidence = 90
        result.reasons.push("Invalid URL format")

        if (enableMemoization) {
          this.cacheResult(url, result, cacheTtl!)
        }
        return result
      }

      const hostname = parsedUrl.hostname.toLowerCase()
      const port = parsedUrl.port
      const pathname = parsedUrl.pathname.toLowerCase()
      const protocol = parsedUrl.protocol

      // Debug logging if enabled
      if (debug) {
        console.log(`[DomainClassifier] Analyzing URL: ${url}`)
        console.log(`[DomainClassifier] Hostname: ${hostname}, Port: ${port}, Path: ${pathname}`)
      }

      // Check blocklist first if provided (highest priority)
      if (mergedOptions.blocklist?.length) {
        if (this.matchesDomainList(hostname, mergedOptions.blocklist)) {
          result.isDevelopment = true
          result.confidence = 100
          result.reasons.push("Domain in blocklist")

          if (enableMemoization) {
            this.cacheResult(url, result, cacheTtl!)
          }
          return result
        }
      }

      // Check allowlist (highest priority)
      if (mergedOptions.allowlist?.length) {
        if (this.matchesDomainList(hostname, mergedOptions.allowlist)) {
          result.isDevelopment = false
          result.confidence = 100
          result.reasons.push("Domain in allowlist")

          if (enableMemoization) {
            this.cacheResult(url, result, cacheTtl!)
          }
          return result
        }
      }

      // File protocol (local files)
      if (protocol === "file:") {
        result.isDevelopment = true
        result.confidence = 100
        result.reasons.push("File protocol")

        if (enableMemoization) {
          this.cacheResult(url, result, cacheTtl!)
        }
        return result
      }

      // Accumulate evidence and confidence
      let devEvidenceCount = 0
      let prodEvidenceCount = 0
      let totalChecks = 0

      // Local IP check
      if (this.isLocalIpAddress(hostname)) {
        devEvidenceCount += 3 // Strong evidence
        result.reasons.push("Local IP address")
      }
      totalChecks++

      // Container environment check
      if (this.isContainerEnvironment(hostname)) {
        devEvidenceCount += 2
        result.reasons.push("Container environment")
      }
      totalChecks++

      // CI/CD environment check
      if (this.isCICDEnvironment(hostname)) {
        devEvidenceCount += 2
        result.reasons.push("CI/CD environment")
      }
      totalChecks++

      // Cloud ephemeral environment check
      if (this.isCloudEphemeralEnvironment(hostname)) {
        devEvidenceCount += 1
        result.reasons.push("Cloud ephemeral environment")
      }
      totalChecks++

      // Check additional dev domains
      if (mergedOptions.additionalDevDomains?.length) {
        if (this.matchesDomainList(hostname, mergedOptions.additionalDevDomains)) {
          devEvidenceCount += 2
          result.reasons.push("In additional dev domains list")
        }
        totalChecks++
      }

      // Development TLDs
      if (!mergedOptions.skipTldCheck && [...this.DEV_TLDS].some(tld => hostname.endsWith(tld))) {
        devEvidenceCount += 3 // Strong evidence
        result.reasons.push("Development TLD")
      }
      totalChecks++

      // Local development servers and tunnel services
      if ([...this.DEV_SERVER_DOMAINS].some(domain => hostname.endsWith(`.${domain}`) || hostname === domain)) {
        devEvidenceCount += 2
        result.reasons.push("Development server domain")
      }
      totalChecks++

      // Local hostnames often used in development
      if ([...this.LOCAL_HOSTNAMES].some(name => hostname === name || hostname.startsWith(`${name}.`))) {
        devEvidenceCount += 2
        result.reasons.push("Local hostname")
      }
      totalChecks++

      // Check if this is a known production domain
      const isProdDomain = this.isLikelyProductionDomain(hostname, mergedOptions)
      if (isProdDomain) {
        prodEvidenceCount += 3 // Strong evidence
        result.reasons.push("Likely production domain")
      }
      totalChecks++

      // Development subdomains/prefixes
      if (!mergedOptions.skipSubdomainCheck) {
        if (
          [...this.DEV_SUBDOMAINS].some(
            subdomain => hostname.startsWith(subdomain) || hostname.includes(`.${subdomain}`)
          )
        ) {
          devEvidenceCount += 2
          result.reasons.push("Development subdomain")
        }
        totalChecks++
      }

      // Common development ports
      if (!mergedOptions.skipPortCheck && port && this.DEV_PORTS.has(port)) {
        devEvidenceCount += 1
        result.reasons.push(`Development port: ${port}`)
      }
      totalChecks++

      // Development path patterns
      if (!mergedOptions.skipPathCheck) {
        if ([...this.DEV_PATHS].some(path => pathname.includes(path))) {
          devEvidenceCount += 1
          result.reasons.push("Development path pattern")
        }
        totalChecks++
      }

      // Development query parameters
      if (!mergedOptions.skipQueryCheck && this.hasDevQueryParams(parsedUrl.searchParams)) {
        devEvidenceCount += 1
        result.reasons.push("Development query parameters")
      }
      totalChecks++

      // Simple domain patterns that are likely development
      if (
        hostname.includes("devel") ||
        hostname.includes("-dev-") ||
        hostname.includes("-test-") ||
        hostname.includes("-stag-") ||
        hostname.includes("-uat-") ||
        hostname.includes("-local-")
      ) {
        devEvidenceCount += 1
        result.reasons.push("Development domain pattern")
      }
      totalChecks++

      // Calculate confidence and determine result
      // If we have evidence for both dev and prod, consider the stronger evidence
      if (devEvidenceCount > 0 || prodEvidenceCount > 0) {
        if (devEvidenceCount > prodEvidenceCount) {
          result.isDevelopment = true
          // Scale confidence based on the evidence strength
          result.confidence = Math.min(
            100,
            Math.round(50 + (devEvidenceCount / (devEvidenceCount + prodEvidenceCount)) * 50)
          )
        } else {
          result.isDevelopment = false
          result.confidence = Math.min(
            100,
            Math.round(50 + (prodEvidenceCount / (devEvidenceCount + prodEvidenceCount)) * 50)
          )
        }
      } else {
        // No strong evidence either way, default to production with moderate confidence
        result.isDevelopment = false
        result.confidence = 60
        result.reasons.push("Insufficient evidence, defaulting to production")
      }

      // For React Native, check __DEV__ flag if available
      try {
        // @ts-ignore - Check for React Native's __DEV__ global
        if (typeof __DEV__ !== "undefined" && __DEV__ === true) {
          devEvidenceCount += 3
          result.reasons.push("React Native __DEV__ flag is true")
          result.isDevelopment = true
          result.confidence = Math.min(100, result.confidence + 20)
        }
      } catch (error) {
        // Ignore platform detection errors
        if (debug) {
          console.warn("[DomainClassifier] Unable to check React Native __DEV__ flag:", error)
        }
      }

      // Cache the result if memoization is enabled
      if (enableMemoization) {
        this.cacheResult(url, result, cacheTtl!)
      }

      return result
    } catch (error) {
      // If any error occurs, fail safe (assume production)
      const result: DomainClassification = {
        isDevelopment: false,
        confidence: 60,
        reasons: ["Error during classification, defaulting to production"],
        timestamp: Date.now()
      }

      if (debug) {
        console.warn(`[DomainClassifier] Error classifying URL: ${url}`, error)
      }

      if (enableMemoization) {
        this.cacheResult(url, result, cacheTtl!)
      }

      return result
    }
  }

  /**
   * Simple Boolean classification (backwards compatibility)
   */
  public isDevelopmentEnvironment(url: string, options?: ClassificationOptions): boolean {
    const result = this.classifyUrl(url, options)
    const threshold = options?.confidenceThreshold || this.defaultOptions.confidenceThreshold || 70

    // Only return true if both isDevelopment is true and confidence meets threshold
    return result.isDevelopment && result.confidence >= threshold
  }

  /**
   * Create a pre-configured classifier function
   */
  public createClassifier(defaultOptions?: ClassificationOptions) {
    return (url: string, options?: ClassificationOptions) => {
      return this.classifyUrl(url, {...defaultOptions, ...options})
    }
  }

  /**
   * Create a pre-configured Boolean classifier function (backwards compatibility)
   */
  public createDevEnvironmentDetector(defaultOptions?: ClassificationOptions) {
    return (url: string, options?: ClassificationOptions) => {
      return this.isDevelopmentEnvironment(url, {...defaultOptions, ...options})
    }
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {size: number; maxSize: number} {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE
    }
  }
}

// Create and export the singleton instance
export const domainClassifier = new DomainEnvironmentClassifier()

// Export convenience methods
export const classifyUrl = domainClassifier.classifyUrl.bind(domainClassifier)
export const isDevelopmentEnvironment = domainClassifier.isDevelopmentEnvironment.bind(domainClassifier)
export const createClassifier = domainClassifier.createClassifier.bind(domainClassifier)
export const createDevEnvironmentDetector = domainClassifier.createDevEnvironmentDetector.bind(domainClassifier)
