FROM freeradius/freeradius-server:latest

# Copy RRNET config into the image to avoid Windows volume permission issues
COPY clients.conf /etc/freeradius/clients.conf
COPY mods-enabled/rest /etc/freeradius/mods-enabled/rest
COPY sites-enabled/default /etc/freeradius/sites-enabled/default

# Match upstream expectations: clients.conf must not be world-writable
RUN chown root:freerad /etc/freeradius/clients.conf \
    && chmod 640 /etc/freeradius/clients.conf \
    && chmod 644 /etc/freeradius/mods-enabled/rest /etc/freeradius/sites-enabled/default


