import DataUpdaterInterface from "./lib/DataUpdaterInterface";
import RuntimeInterface from "./lib/RuntimeInterface";
import CollectionStatusProviderInterface from "./lib/CollectionStatusProviderInterface";
import EventDataInterface from "./lib/EventDataInterface";

export const EVENT_DATA_IS_FULL_UPDATE = "__isFullUpdate";

export const isFullUpdate = (eventData: EventDataInterface): boolean|undefined => {
  return eventData[EVENT_DATA_IS_FULL_UPDATE];
};

export default class CollectionDataUpdater {
  public constructor (
    private collectionStatusProvider: CollectionStatusProviderInterface,
    private dataRevealers: DataUpdaterInterface[],
    private runtimes: RuntimeInterface[],
  ) {
  }

  public async updateSingleToken(eventData: EventDataInterface): Promise<void> {
    let processedEventData: EventDataInterface = await this.collectionStatusProvider.processEventDataBeforeUpdate(eventData);

    for (const dataRevealer of this.dataRevealers) {
      processedEventData = await dataRevealer.updateToken(processedEventData);
    }
  }

  public async updateAllTokens(partialEventData: { [key: string]: any } = {}): Promise<void> {
    partialEventData[EVENT_DATA_IS_FULL_UPDATE] = true;

    // Get all possible token IDs
    const allTokenIds = await this.collectionStatusProvider.getTokenIds();

    // Loop through each token ID and update it if it's minted
    for (const tokenId of allTokenIds) {
      try {
        // Check if the token has been minted by querying its owner
        const owner = await this.collectionStatusProvider.contract.ownerOf(tokenId);

        // If the token has an owner (i.e., it's been minted), process it
        if (owner) {
          const eventData = { tokenId: tokenId.toNumber(), ...partialEventData };
          await this.updateSingleToken(eventData);
        }
      } catch (error) {
        // If querying the owner reverts, it likely means the token hasn't been minted
        // Continue to the next token ID
        continue;
      }
    }
  }

  public async start(): Promise<void> {
    if (this.runtimes.length === 0) {
      console.log("No runtime available, waiting for direct calls...");

      return;
    }

    for (const runtime of this.runtimes) {
      runtime.run(this);
    }
  }
}
