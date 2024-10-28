async genericMessage(
    service: number | Uint8Array,
    classCode: number | Uint8Array,
    instance: number | Uint8Array,
    attribute: number | Uint8Array = new Uint8Array(),
    requestData: any = new Uint8Array(),
    dataType: DataType | null = null,
    name: string = "generic",
    connected: boolean = true,
    unconnectedSend: boolean = false,
    routePath: boolean | CIPSegment[] | Uint8Array | string = true,
    options: { [key: string]: any } = {}
): Promise<Tag> {
    if (connected) {
        await this.withForwardOpen(async () => {});
    }

    const kwargs: any = {
        service,
        classCode,
        instance,
        attribute,
        requestData,
        dataType,
    };

    if (connected) {
        kwargs.sequence = this._sequence;
    } else {
        if (routePath === true) {
            kwargs.routePath = PADDED_EPATH.encode(
                this._cfg.cipPath,
                { length: true, padLength: true }
            );
        } else if (typeof routePath === 'string') {
            kwargs.routePath = PADDED_EPATH.encode(
                parseCipRoute(routePath),
                { length: true, padLength: true }
            );
        } else if (routePath instanceof Uint8Array) {
            kwargs.routePath = routePath;
        } else if (routePath) {
            kwargs.routePath = PADDED_EPATH.encode(
                routePath,
                { length: true, padLength: true }
            );
        }

        kwargs.unconnectedSend = unconnectedSend;
    }

    const RequestClass = connected ? GenericConnectedRequestPacket : GenericUnconnectedRequestPacket;
    const request = new RequestClass(kwargs);

    this._log.info(`Sending generic message: ${name}`);
    const response = await this.send(request);
    if (!response) {
        this._log.error(`Generic message ${name} failed: ${response.error}`);
    } else {
        this._log.info(`Generic message ${name} completed`);
    }

    if (options.returnResponsePacket) {
        return new Tag(name, response, dataType, response.error);
    }

    return new Tag(name, response.value, dataType, response.error);
}