// @ts-nocheck
import { prisma } from "../prisma";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { request } from "http";
const bizSdk = require("facebook-nodejs-business-sdk");
const AdAccount = bizSdk.AdAccount;
const Campaign = bizSdk.Campaign;

export function fbAdRoutes(fastify: FastifyInstance) {
  const facebookAppId = fastify?.config.FACEBOOK_APP_ID;
  const facebookAccessToken = fastify?.config.FACEBOOK_ACCESS_TOKEN;
  const facebookAccessSecret = fastify?.config.FACEBOOK_ACCESS_SECRET;
  const facebookAdAccountId = fastify?.config.FACEBOOK_AD_ACCOUNT_ID;
  const facebookPageId = fastify?.config.FACEBOOK_PAGE_ID;

  const fbAdsApi = bizSdk.FacebookAdsApi.init(facebookAccessToken);
  const showDebugingInfo = true;
  fbAdsApi.setDebug(showDebugingInfo);

  const logApiCallResult = (apiCallName, data) => {
    console.log(apiCallName);
    if (showDebugingInfo) {
      console.log("Data:" + JSON.stringify(data));
    }
  };

  const getPayment = async (paymentId) => {
    return await prisma.payments.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        pets: {
          include: {
            pet_images: true,
          },
        },
      },
    });
  };

  const createFbAdCampaign = async (_fbCampaignCount: number) => {
    let fields = [];
    let params = {
      name: `Lost-Petto-${_fbCampaignCount?._count?.id + 1}`,
      objective: "LINK_CLICKS",
      status: "ACTIVE",
      special_ad_categories: [],
    };

    const campaign = await new AdAccount(facebookAdAccountId).createCampaign(
      fields,
      params
    );

    if (!campaign) throw new Error("Failed to create campaign");

    const dbFbCampaign = await prisma.fb_campaigns.create({
      data: {
        fb_campaign_id: campaign?.id,
        name: params.name,
        objective: params.objective,
        status: params.status,
      },
    });

    logApiCallResult("campaigns api call complete.", campaign);

    return dbFbCampaign;
  };

  const createAdSet = async (
    _pet: Object,
    _paymentId: string,
    _fbCampaignCount: string,
    _fbAdSetCount: string
  ) => {
    let campaign = null;
    let fbCampaignId = null;
    if (_fbAdSetCount?._count?.id % 4500 === 0) {
      campaign = await createFbAdCampaign(_fbCampaignCount);

      fbCampaignId = campaign.fb_campaign_id;
    } else {
      const latestAdset = await prisma.fb_adsets.findFirst({
        orderBy: { created_at: "desc" },
      });

      campaign = await prisma.fb_campaigns.findUnique({
        where: {
          id: latestAdset?.campaign_id,
        },
      });

      console.log(
        "🚀 ~ file: fbAds.ts:83 ~ fbAdRoutes ~ latestAdset",
        campaign
      );

      fbCampaignId = campaign?.fb_campaign_id;
    }

    let adsetFields = [];
    let adsetParams = {
      name: _paymentId,
      optimization_goal: "LINK_CLICKS",
      billing_event: "IMPRESSIONS",
      daily_budget: 700,
      campaign_id: fbCampaignId,
      status: "PAUSED",
      bid_strategy: "LOWEST_COST_WITH_BID_CAP",
      bid_amount: 100,
      targeting: {
        geo_locations: {
          custom_locations: [
            {
              latitude: 45.458311,
              longitude: -72.902611,
              radius: 5,
              distance_unit: "mile",
            },
          ],
        },
      },
    };
    console.log(
      "🚀 ~ file: fbAds.ts:109 ~ fbAdRoutes ~ adsetParams",
      adsetParams.targeting.geo_locations
    );

    console.log(
      "🚀 ~ file: fbAds.ts:109 ~ fbAdRoutes ~ adsetParams",
      adsetParams
    );

    try {
      const adSet = await new AdAccount(facebookAdAccountId).createAdSet(
        adsetFields,
        adsetParams
      );

      logApiCallResult("adsets api call complete.", adSet);

      if (!adSet) throw new Error("Adset failed");

      console.log("🚀 ~ file: fbAds.ts:77 ~ fbAdRoutes ~ campaign", campaign);

      const dbFbAdset = await prisma.fb_adsets.create({
        data: {
          optimization_goal: adsetParams.optimization_goal,
          billing_event: adsetParams.billing_event,
          daily_budget: adsetParams.daily_budget,
          campaign_id: campaign?.id,
          targeting: adsetParams.targeting,
          status: adsetParams.status,
          fb_adset_id: adSet?.id,
        },
      });
      console.log(
        "🚀 ~ file: fbAds.ts:139 ~ fbAdRoutes ~ dbFbAdset",
        dbFbAdset
      );

      return dbFbAdset;
    } catch (error) {
      console.log(error);
    }
  };

  const createAd = async (_adset: string, _pet: Object) => {
    if (!_pet) throw new Error("No pet found");

    console.log("create ad");

    try {
      let childAttachments = () => {
        const petImages = _pet.pet_images?.splice(0, 1) || [];
        const childAttachments = [];
        petImages.forEach((image) => {
          childAttachments.push({
            link: `https://lost-dogge.com/pet/lost/${_pet.id}`,
            picture: image.url,
          });
        });

        return childAttachments;
      };

      console.log(_pet);

      let adCreativeFields = [];
      let adCreativeParams = {
        name: _pet.id,
        call_to_action_type: "OPEN_LINK",
        object_story_spec: {
          page_id: facebookAppId,
          link_data: {
            link: `https://lost-dogge.com/pet/lost/${_pet.id}`,
            picture: _pet.pet_images[0].url,
          },
        },
        child_attachments: childAttachments(_pet),
      };

      const adCreative = await new AdAccount(
        facebookAdAccountId
      ).createAdCreative(adCreativeFields, adCreativeParams);

      logApiCallResult("ad creative api call complete.", adCreative);

      let adFields = [];
      let adParams = {
        name: _pet.id,
        adset_id: _adset.fb_adset_id,
        creative: { creative_id: adCreative.id },
        body: `Last seen at ${_pet.address}`,
        status: "PAUSED",
      };

      const ad = new AdAccount(facebookAdAccountId).createAd(
        adFields,
        adParams
      );

      logApiCallResult("ads api call complete.", ad);
    } catch (error) {
      console.log("🚀 ~ file: fbAds.ts:212 ~ createAd ~ error", error);
    }
  };

  const createFbAdFlow = async (_paymentId: string) => {
    if (!_paymentId) throw new Error("No payment found");

    const payment = await getPayment(_paymentId);

    if (payment?.status !== 1) throw new Error("Payment has not been made");

    const fbCampaignCount = await prisma.fb_campaigns.aggregate({
      _count: {
        id: true,
      },
    });

    let fbAdSetCount = await prisma.fb_adsets.aggregate({
      _count: {
        id: true,
      },
    });

    let pet = payment.pets;

    if (!pet) throw new Error("No pet found");

    const adset = await createAdSet(
      pet,
      _paymentId,
      fbCampaignCount,
      fbAdSetCount
    );
    const ad = await createAd(adset, pet);

    return {
      ad,
      adset,
    };
  };

  fastify.post(
    "/api/v1/fb/ad",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const adData = await createFbAdFlow(
        "ee869e78-09e8-475c-96ce-23914b4442a1"
      );
      reply.send(adData);
    }
  );
}
