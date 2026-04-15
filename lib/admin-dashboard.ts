import { prisma } from "@/lib/prisma";
import {
  getAffiliateProfileCountSafe,
  getAffiliateProgramSettingsSafe,
} from "@/lib/affiliate";
import { getPaymentGatewaySettingsSafe, getVipPlansSafe } from "@/lib/payments";
import { getVipProgramSettingsSafe } from "@/lib/vip";

export async function getAdminOverviewData() {
  const [totalMovies, homeCount, popularCount, newCount, totalUsers, totalFavorites, totalHistory, totalVipUsers] =
    await Promise.all([
    prisma.movie.count(),
    prisma.movie.count({ where: { inHome: true } }),
    prisma.movie.count({ where: { inPopular: true } }),
    prisma.movie.count({ where: { inNew: true } }),
    prisma.user.count(),
    prisma.userFavorite.count(),
    prisma.watchHistory.count(),
    prisma.user.count({
      where: {
        vipExpiresAt: {
          gt: new Date(),
        },
      },
    }),
  ]);
  const [affiliateProfiles, settings, vipSettings, paymentSettings, vipPlans] = await Promise.all([
    getAffiliateProfileCountSafe(),
    getAffiliateProgramSettingsSafe(),
    getVipProgramSettingsSafe(),
    getPaymentGatewaySettingsSafe(),
    getVipPlansSafe({ activeOnly: true }),
  ]);

  return {
    affiliateSchemaIssue: affiliateProfiles.schemaIssue ?? settings.schemaIssue,
    affiliateSchemaReady:
      affiliateProfiles.schemaReady && settings.schemaReady,
    defaultCommissionRate: settings.settings.defaultCommissionRate,
    homeCount,
    newCount,
    popularCount,
    totalVipUsers,
    totalAffiliateProfiles: affiliateProfiles.count,
    totalFavorites,
    totalHistory,
    totalMovies,
    totalUsers,
    vipPreviewLimitMinutes: vipSettings.settings.previewLimitMinutes,
    vipSchemaIssue: vipSettings.schemaIssue,
    vipSchemaReady: vipSettings.schemaReady,
    paymentGatewayEnabled: paymentSettings.runtime.enabled,
    paymentSchemaIssue: paymentSettings.schemaIssue ?? vipPlans.schemaIssue,
    paymentSchemaReady: paymentSettings.schemaReady && vipPlans.schemaReady,
    activeVipPlans: vipPlans.plans.length,
  };
}

export async function getAdminUserTableData(query: string | undefined) {
  const trimmedQuery = query?.trim();
  const [settings, vipSettings] = await Promise.all([
    getAffiliateProgramSettingsSafe(),
    getVipProgramSettingsSafe(),
  ]);

  try {
    const users = await prisma.user.findMany({
      where: trimmedQuery
        ? {
            OR: [
              {
                email: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
              {
                name: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
              {
                affiliateProfile: {
                  is: {
                    referralCode: {
                      contains: trimmedQuery.toUpperCase(),
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        email: true,
        id: true,
        name: true,
        vipExpiresAt: true,
        vipStartedAt: true,
        _count: {
          select: {
            favorites: true,
            sessions: true,
            watchHistory: true,
          },
        },
        affiliateProfile: {
          select: {
            activeReferrals: true,
            availableBalance: true,
            commissionRate: true,
            referralCode: true,
            totalCommission: true,
          },
        },
        affiliateReferral: {
          select: {
            profile: {
              select: {
                referralCode: true,
                user: {
                  select: {
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      take: 100,
    });

    return {
      affiliateSchemaIssue: settings.schemaIssue,
      affiliateSchemaReady: settings.schemaReady,
      defaultCommissionRate: settings.settings.defaultCommissionRate,
      vipSchemaIssue: vipSettings.schemaIssue,
      vipSchemaReady: vipSettings.schemaReady,
      totalUsers: users.length,
      users,
    };
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      !["P2021", "P2022"].includes(String(error.code))
    ) {
      throw error;
    }

    const users = await prisma.user.findMany({
      where: trimmedQuery
        ? {
            OR: [
              {
                email: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
              {
                name: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
            ],
          }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        email: true,
        id: true,
        name: true,
        vipExpiresAt: true,
        vipStartedAt: true,
        _count: {
          select: {
            favorites: true,
            sessions: true,
            watchHistory: true,
          },
        },
      },
      take: 100,
    });

    return {
      affiliateSchemaIssue:
        settings.schemaIssue ??
        "Data affiliate belum siap di database runtime. Kolom referral dan komisi sementara dinonaktifkan sampai migration dijalankan.",
      affiliateSchemaReady: false,
      defaultCommissionRate: settings.settings.defaultCommissionRate,
      vipSchemaIssue: vipSettings.schemaIssue,
      vipSchemaReady: vipSettings.schemaReady,
      totalUsers: users.length,
      users: users.map((user) => ({
        ...user,
        affiliateProfile: null,
        affiliateReferral: null,
      })),
    };
  }
}
